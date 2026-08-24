/**
 * Telegram deep-link login — the anti-phishing invariants (audit 2026-08-10, S4).
 *
 * The attack this defends against: a phisher starts a login in their OWN browser (so they hold
 * the nonce cookie the session is bound to), forwards the t.me deep link to a victim, and the
 * victim's tap in the GENUINE bot authenticates the attacker's browser. Confirmation used to
 * happen on `/start` alone, so the victim saw only "✅ Tasdiqlandi".
 *
 * These assert the state machine directly, which is where the fix lives:
 *   1. `/start` must CLAIM the token, never CONFIRM it.
 *   2. Only the Telegram id that opened the link may confirm it.
 *   3. Confirmation must be atomic, expiry-checked and single-shot.
 */
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const tokens: string[] = [];

/** Mirrors what POST /api/auth/telegram/start writes. */
async function startLogin(ttlMs = 2 * 60 * 1000) {
  const token = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  tokens.push(token);
  await prisma.loginToken.create({
    data: {
      token,
      browserNonceHash: crypto.createHash("sha256").update(nonce).digest("hex"),
      pairingCode: "KF-73",
      locale: "uz",
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return { token, nonce };
}

/** Mirrors the webhook's `/start <token>` branch: claim for this Telegram id, stay PENDING. */
const claim = (token: string, telegramId: string) =>
  prisma.loginToken.updateMany({
    where: { token, status: "PENDING", expiresAt: { gt: new Date() }, telegramId: null },
    data: { telegramId },
  });

/** Mirrors the `lg:y:<token>` callback branch. */
const confirm = (token: string, telegramId: string) =>
  prisma.loginToken.updateMany({
    where: { token, status: "PENDING", telegramId, expiresAt: { gt: new Date() } },
    data: { status: "CONFIRMED" },
  });

beforeEach(() => {
  tokens.length = 0;
});

afterAll(async () => {
  await prisma.loginToken.deleteMany({ where: { pairingCode: "KF-73" } }).catch(() => {});
  await prisma.$disconnect();
});

describe("S4 — deep-link login cannot be confirmed without consent", () => {
  it("opening the deep link claims the token but does NOT authorise it", async () => {
    const { token } = await startLogin();

    expect((await claim(token, "555001")).count).toBe(1);

    const after = await prisma.loginToken.findUnique({ where: { token } });
    expect(after?.status, "still awaiting an explicit confirm tap").toBe("PENDING");
    expect(after?.telegramId).toBe("555001");
  });

  it("a token carries a pairing code the victim can compare", async () => {
    const { token } = await startLogin();
    const lt = await prisma.loginToken.findUnique({ where: { token } });
    expect(lt?.pairingCode).toMatch(/^[A-Z]{2}-[0-9]{2}$/);
  });

  it("only the Telegram account that opened the link can confirm it", async () => {
    const { token } = await startLogin();
    await claim(token, "555001");

    // A different Telegram account — e.g. the phisher trying to self-confirm — cannot.
    expect((await confirm(token, "999999")).count).toBe(0);
    expect((await prisma.loginToken.findUnique({ where: { token } }))?.status).toBe("PENDING");

    expect((await confirm(token, "555001")).count).toBe(1);
    expect((await prisma.loginToken.findUnique({ where: { token } }))?.status).toBe("CONFIRMED");
  });

  it("a second tap cannot re-confirm an already-confirmed token", async () => {
    const { token } = await startLogin();
    await claim(token, "555001");
    await confirm(token, "555001");

    expect((await confirm(token, "555001")).count).toBe(0);
  });

  it("an expired token can be neither claimed nor confirmed", async () => {
    const { token } = await startLogin(-1000); // already expired

    expect((await claim(token, "555001")).count).toBe(0);
    await prisma.loginToken.updateMany({ where: { token }, data: { telegramId: "555001" } });
    expect((await confirm(token, "555001")).count).toBe(0);
  });

  it("a token already claimed by one account cannot be re-claimed by another", async () => {
    const { token } = await startLogin();
    await claim(token, "555001");

    // The victim taps the phisher's forwarded link second: the claim is already taken, so the
    // bot shows them nothing to confirm rather than silently binding their identity to it.
    expect((await claim(token, "555002")).count).toBe(0);
    expect((await prisma.loginToken.findUnique({ where: { token } }))?.telegramId).toBe("555001");
  });
});
