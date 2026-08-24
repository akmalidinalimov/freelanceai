/**
 * Launch-ticket sign-in — the invariants that keep a zero-tap login from becoming a way in.
 *
 * A ticket is a bearer credential sitting in a chat message, so the guarantees that matter are:
 * it works exactly once, it dies quickly, and it can never be crossed with the browser login flow
 * whose whole defence is a nonce the phisher does hold.
 */
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mintLaunchTicket, consumeLaunchTicket, isLaunchTicket } from "@/lib/launch-ticket";

const tokens: string[] = [];
const tg = () => `88${crypto.randomInt(1_000_000, 9_999_999)}`;

const mint = async (over: Partial<{ telegramId: string }> = {}) => {
  const t = await mintLaunchTicket({ telegramId: over.telegramId ?? tg(), firstName: "T", locale: "uz" });
  tokens.push(t);
  return t;
};

beforeEach(() => {
  process.env.APP_ORIGIN = "https://gigora.ai";
});

afterAll(async () => {
  if (tokens.length) await prisma.loginToken.deleteMany({ where: { token: { in: tokens } } });
  await prisma.$disconnect();
});

describe("launch ticket", () => {
  it("signs in once and only once", async () => {
    const token = await mint();
    const first = await consumeLaunchTicket(token);
    expect(first?.telegramId).toBeTruthy();
    // A forwarded message, a double-tap, a retry — all must find it spent.
    expect(await consumeLaunchTicket(token)).toBeNull();
  });

  it("survives a concurrent double-tap without issuing two sessions", async () => {
    const token = await mint();
    const results = await Promise.all([consumeLaunchTicket(token), consumeLaunchTicket(token)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses an expired ticket", async () => {
    const token = await mint();
    await prisma.loginToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeLaunchTicket(token)).toBeNull();
  });

  it("CANNOT redeem a browser-flow login token", async () => {
    // The browser flow's defence is a nonce cookie. If a launch ticket could be swapped for one of
    // those, a phisher holding the nonce would get a second, nonce-free way to cash it.
    const token = "bl_" + crypto.randomBytes(24).toString("hex");
    tokens.push(token);
    await prisma.loginToken.create({
      data: {
        token,
        status: "CONFIRMED",
        browserNonceHash: crypto.createHash("sha256").update("nonce").digest("hex"),
        telegramId: tg(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(await consumeLaunchTicket(token)).toBeNull();
    // and it must still be spendable by the flow it actually belongs to
    const row = await prisma.loginToken.findUnique({ where: { token } });
    expect(row?.status).toBe("CONFIRMED");
  });

  it("refuses a ticket that is not CONFIRMED", async () => {
    const token = await mint();
    await prisma.loginToken.update({ where: { token }, data: { status: "PENDING" } });
    expect(await consumeLaunchTicket(token)).toBeNull();
  });

  it("carries the identity the bot minted it for", async () => {
    const id = tg();
    const token = await mint({ telegramId: id });
    expect((await consumeLaunchTicket(token))?.telegramId).toBe(id);
  });

  it("expires in minutes, not days", async () => {
    const token = await mint();
    const row = await prisma.loginToken.findUniqueOrThrow({ where: { token } });
    const mins = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(1);
    expect(mins).toBeLessThanOrEqual(15); // a bearer token in a forwardable message
  });

  it("rejects malformed tokens without touching the database", () => {
    expect(isLaunchTicket("")).toBe(false);
    expect(isLaunchTicket("bl_short")).toBe(false);
    expect(isLaunchTicket(crypto.randomBytes(24).toString("hex"))).toBe(false); // no prefix
  });
});
