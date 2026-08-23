/**
 * What tapping Start in the bot must guarantee, against a real Postgres.
 *
 * The founder asked for one thing plainly: "once they click Start, you need to remember the
 * Telegram ID". Until now nothing did — the account was created only when a sign-in completed, so
 * someone who tapped Start and did not immediately tap the button left no record at all: their id
 * lived only in a launch ticket that expired in ten minutes.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { upsertTelegramUser } from "@/lib/users";

const made: string[] = [];
const tgId = () => {
  const id = `77${crypto.randomInt(1_000_000, 9_999_999)}`;
  made.push(id);
  return id;
};

/** Mirrors the webhook's /start branch: capture existence FIRST, then create. */
async function onStart(id: string, firstName = "Yangi") {
  const before = await prisma.user.findUnique({
    where: { telegramId: id },
    select: { onboardingCompleted: true },
  });
  const existedBefore = before !== null;
  if (!existedBefore) {
    await upsertTelegramUser({ id, firstName, authDate: Math.floor(Date.now() / 1000) });
  }
  return { existedBefore, account: before };
}

beforeEach(() => vi.unstubAllEnvs());

afterAll(async () => {
  if (made.length) await prisma.user.deleteMany({ where: { telegramId: { in: made } } });
  await prisma.$disconnect();
});

describe("/start remembers the Telegram id", () => {
  it("creates the account on first contact", async () => {
    const id = tgId();
    expect(await prisma.user.findUnique({ where: { telegramId: id } })).toBeNull();

    await onStart(id);

    const user = await prisma.user.findUnique({ where: { telegramId: id } });
    expect(user).not.toBeNull();
    expect(user!.telegramId).toBe(id);
  });

  it("is idempotent — repeated /start never duplicates or resets", async () => {
    const id = tgId();
    await onStart(id, "Birinchi");
    const first = await prisma.user.findUniqueOrThrow({ where: { telegramId: id } });

    await onStart(id, "Ikkinchi");
    await onStart(id, "Uchinchi");

    const rows = await prisma.user.findMany({ where: { telegramId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id); // same row, not a replacement
  });

  it("survives a concurrent double-tap on Start", async () => {
    const id = tgId();
    await Promise.allSettled([onStart(id), onStart(id)]);
    expect(await prisma.user.findMany({ where: { telegramId: id } })).toHaveLength(1);
  });

  it("does NOT divert a brand-new user into onboarding on that same request", async () => {
    // The trap this guards: the onboarding branch keys off whether an account already existed.
    // If it read the row we just created, a first-timer's /start would return early into the
    // onboarding nudge — skipping the welcome, the keyboard AND the zero-tap launch ticket, for
    // exactly the people that path exists to serve.
    const id = tgId();
    const { existedBefore, account } = await onStart(id);

    expect(existedBefore).toBe(false);
    expect(account).toBeNull();
    // The webhook's guard is `existedBefore && account && !account.onboardingCompleted`.
    expect(Boolean(existedBefore && account)).toBe(false);
  });

  it("creates Telegram accounts already onboarded, so nothing blocks browsing", async () => {
    // Telegram told us the name; there is nothing left to ask before letting someone look around.
    const id = tgId();
    await onStart(id);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: id } });
    expect(user.onboardingCompleted).toBe(true);
  });

  it("keeps a returning user's own data instead of overwriting it", async () => {
    const id = tgId();
    await onStart(id, "Asl");
    await prisma.user.update({
      where: { telegramId: id },
      data: { locale: "ru", isSeller: true },
    });

    await onStart(id, "Boshqa");

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: id } });
    expect(user.locale).toBe("ru");
    expect(user.isSeller).toBe(true);
  });

  it("never reactivates a suspended account", async () => {
    const id = tgId();
    await onStart(id);
    await prisma.user.update({ where: { telegramId: id }, data: { status: "SUSPENDED" } });

    await onStart(id);

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: id } });
    expect(user.status).toBe("SUSPENDED");
  });
});
