/**
 * Menu-button backfill drain, against real Postgres with the Bot API stubbed.
 *
 * What this protects: the backfill exists because Telegram stores the menu button per chat and
 * never refreshes it, so paired users keep whatever URL was current when they last messaged the
 * bot. If the drain silently skips users, or re-walks ones it already did, or keeps hammering a
 * user who blocked the bot, the backfill quietly fails to do the one thing it is for.
 */
import { describe, it, expect, afterAll, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncChatMenuButtons } from "./menu-button-backfill";

const madeUserIds: string[] = [];
const tag = crypto.randomBytes(4).toString("hex");

/** A paired, active user — exactly what the backfill targets. */
async function makeUser(n: number, over: { notifyTelegram?: boolean; locale?: string } = {}) {
  const u = await prisma.user.create({
    data: {
      email: `mb-${tag}-${n}@example.test`,
      telegramId: `9${tag.slice(0, 6)}${n}`,
      locale: over.locale ?? "uz",
      notifyTelegram: over.notifyTelegram ?? true,
      status: "ACTIVE",
    },
    select: { id: true, telegramId: true },
  });
  madeUserIds.push(u.id);
  return u;
}

/** Stub the Bot API. `blockedIds` answer 403; everyone else succeeds. Records who was called. */
function stubBotApi(blockedIds: Set<string> = new Set()) {
  const called: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: { body?: string }) => {
      const body = init?.body ? (JSON.parse(init.body) as { chat_id?: string }) : {};
      const id = String(body.chat_id ?? "");
      called.push(id);
      if (blockedIds.has(id)) {
        return { ok: false, status: 403, json: async () => ({ ok: false }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as unknown as Response;
    })
  );
  return called;
}

beforeEach(() => {
  process.env.APP_ORIGIN = "https://gigora.ai";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  if (madeUserIds.length) await prisma.user.deleteMany({ where: { id: { in: madeUserIds } } });
  await prisma.$disconnect();
});

describe("syncChatMenuButtons", () => {
  it("sets a button for every paired user, including ones who muted notifications", async () => {
    const a = await makeUser(1);
    const b = await makeUser(2, { notifyTelegram: false });
    const called = stubBotApi();

    const res = await syncChatMenuButtons();

    expect(res.done).toBe(true);
    expect(called).toContain(a.telegramId);
    // The muted user MUST still be reached — the button is UI, not a notification.
    expect(called).toContain(b.telegramId);
    expect(res.ok).toBeGreaterThanOrEqual(2);
    expect(res.failed).toBe(0);
  }, 120_000);

  it("marks a 403 user as blocked and skips them on the next run", async () => {
    const victim = await makeUser(3);
    const first = stubBotApi(new Set([victim.telegramId!]));

    const res1 = await syncChatMenuButtons();
    expect(first).toContain(victim.telegramId);
    expect(res1.blocked).toBeGreaterThanOrEqual(1);

    const row = await prisma.user.findUnique({
      where: { id: victim.id },
      select: { telegramBlockedAt: true },
    });
    expect(row?.telegramBlockedAt).toBeInstanceOf(Date);

    // Second run: they are out of the audience entirely, so no rate limit is spent on them.
    vi.unstubAllGlobals();
    const second = stubBotApi();
    await syncChatMenuButtons();
    expect(second).not.toContain(victim.telegramId);
  }, 120_000);

  it("resumes from a cursor without re-walking earlier users", async () => {
    const made = [await makeUser(4), await makeUser(5), await makeUser(6)];
    const ordered = made.map((u) => u.id).sort();
    const resumeFrom = ordered[0];
    const called = stubBotApi();

    const res = await syncChatMenuButtons({ cursor: resumeFrom });

    expect(res.done).toBe(true);
    const idOf = (uid: string) => made.find((m) => m.id === uid)!.telegramId!;
    // The cursor is exclusive: the user AT the cursor is already done, so skip them.
    expect(called).not.toContain(idOf(ordered[0]));
    expect(called).toContain(idOf(ordered[1]));
    expect(called).toContain(idOf(ordered[2]));
  }, 120_000);

  it("returns done:false and a resumable cursor when the time budget is spent", async () => {
    await makeUser(7);
    stubBotApi();
    // A zero budget must not claim the work is finished — that would strand every remaining user.
    const res = await syncChatMenuButtons({ budgetMs: 0 });
    expect(res.done).toBe(false);
    expect(res.skipped).toBeUndefined();
  }, 120_000);

  it("does not run two drains at once", async () => {
    await makeUser(8);
    stubBotApi();
    const [first, second] = await Promise.all([syncChatMenuButtons(), syncChatMenuButtons()]);
    // One holds the advisory lock; the other must bail rather than double-spend the rate limit.
    const skipped = [first, second].filter((r) => r.skipped === "locked");
    expect(skipped).toHaveLength(1);
  }, 120_000);
});
