/**
 * The last place the removed registration wall was still standing.
 *
 * New Telegram accounts are created onboarded, but every account made before that change carries
 * `onboardingCompleted: false` — and the webhook treats that as "unfinished profile", returning
 * early with an onboarding nudge instead of the welcome, the reply keyboard and the menu button.
 * These pin who the backfill touches, and just as importantly who it must not.
 */
import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  backfillTelegramOnboarding,
  countUnonboardedTelegramUsers,
} from "./onboarding-backfill";

const made: string[] = [];

async function mkUser(opts: {
  telegram?: boolean;
  onboarded?: boolean;
  isSeller?: boolean;
}) {
  const tag = crypto.randomBytes(5).toString("hex");
  const u = await prisma.user.create({
    data: {
      email: `ob-${tag}@example.test`,
      telegramId: opts.telegram === false ? null : `66${crypto.randomInt(1_000_000, 9_999_999)}`,
      onboardingCompleted: opts.onboarded ?? false,
      isSeller: opts.isSeller ?? false,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  made.push(u.id);
  return u.id;
}

const onboarded = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { onboardingCompleted: true } }))
    .onboardingCompleted;

afterAll(async () => {
  if (made.length) await prisma.user.deleteMany({ where: { id: { in: made } } });
  await prisma.$disconnect();
});

describe("backfillTelegramOnboarding", () => {
  it("marks a pre-existing Telegram account as onboarded", async () => {
    const id = await mkUser({ telegram: true, onboarded: false });
    await backfillTelegramOnboarding();
    expect(await onboarded(id)).toBe(true);
  });

  it("does NOT touch email or Google accounts", async () => {
    // Nothing told us their name or what they came to do — that is the case the form exists for.
    const id = await mkUser({ telegram: false, onboarded: false });
    await backfillTelegramOnboarding();
    expect(await onboarded(id)).toBe(false);
  });

  it("leaves already-onboarded accounts alone and reports zero on a second run", async () => {
    await mkUser({ telegram: true, onboarded: false });
    const first = await backfillTelegramOnboarding();
    expect(first.updated).toBeGreaterThanOrEqual(1);

    const second = await backfillTelegramOnboarding();
    expect(second.pending).toBe(0);
    expect(second.updated).toBe(0);
  });

  it("covers sellers too, since they are the ones the early return hurt most", async () => {
    // A seller diverted into the nudge never got their role-aware keyboard back.
    const id = await mkUser({ telegram: true, onboarded: false, isSeller: true });
    await backfillTelegramOnboarding();
    expect(await onboarded(id)).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { isSeller: true } });
    expect(u.isSeller, "the backfill must not disturb anything else").toBe(true);
  });

  it("counts exactly what it is about to change", async () => {
    await mkUser({ telegram: true, onboarded: false });
    const before = await countUnonboardedTelegramUsers();
    expect(before).toBeGreaterThanOrEqual(1);
    const res = await backfillTelegramOnboarding();
    expect(res.updated).toBe(before);
    expect(await countUnonboardedTelegramUsers()).toBe(0);
  });
});
