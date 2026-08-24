import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Zero-tap Mini App sign-in.
 *
 * The webhook already knows a user's Telegram id the moment they message the bot, so there is no
 * reason to rediscover it in the browser and no reason to make them read a code back. When the bot
 * sends a Mini App button it embeds a launch ticket; opening the app spends it and the session
 * exists. No taps, and — unlike the initData bridge — it does not depend on Telegram exposing
 * anything to the page, which is what makes it work even when initData comes back empty.
 *
 * WHY THIS IS NOT THE PHISHING HOLE THE PAIRING CODE CLOSED. That attack runs the other way: an
 * attacker starts a login in THEIR browser and forwards the deep link, so the victim's tap
 * authenticates the attacker's session. Here nothing is attacker-supplied — we mint the link
 * ourselves and deliver it into the user's own chat, a channel Telegram has already authenticated.
 * There is no foreign token to confirm, so a confirmation code protects nothing.
 *
 * The residual risk is the user FORWARDING that message before opening it, so a ticket is
 * single-use and lives ten minutes. It is also never attached to the persistent reply keyboard or
 * the chat menu button: those are long-lived surfaces, and a long-lived ticket is a standing key.
 * They rely on the session cookie the first ticket established.
 */

/** Ten minutes: long enough to tap a message you just received, short enough to bound a forward. */
const TICKET_TTL_MS = 10 * 60 * 1000;

/** Namespaces the token so a launch ticket is never mistaken for a browser-flow login token. */
const PREFIX = "bl_";

export type TicketIdentity = {
  telegramId: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  locale?: string | null;
};

/**
 * Mint a single-use launch ticket for a Telegram user.
 *
 * Stored with `browserNonceHash: null`, which is what keeps the two flows apart: the browser
 * provider REQUIRES a nonce and so can never accept one of these, and this provider requires the
 * absence of one and so can never accept a browser token whose nonce a phisher holds.
 */
export async function mintLaunchTicket(id: TicketIdentity): Promise<string> {
  const token = PREFIX + crypto.randomBytes(24).toString("hex");
  await prisma.loginToken.create({
    data: {
      token,
      // CONFIRMED on creation: the bot only ever mints these into a chat Telegram already
      // authenticated, so there is nothing left for the user to confirm.
      status: "CONFIRMED",
      browserNonceHash: null,
      pairingCode: null,
      telegramId: id.telegramId,
      firstName: id.firstName ?? null,
      lastName: id.lastName ?? null,
      username: id.username ?? null,
      locale: id.locale ?? null,
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });
  return token;
}

/** Shape a launch ticket must have. Exported so tests can assert the rules rather than restate them. */
export function isLaunchTicket(token: string): boolean {
  return token.startsWith(PREFIX) && token.length === PREFIX.length + 48;
}

/**
 * Spend a launch ticket, atomically. Returns the identity it was minted for, or null.
 *
 * The single UPDATE is the whole concurrency story: two taps race, one updates a row, the other
 * matches nothing. There is no read-then-write window to lose.
 */
export async function consumeLaunchTicket(token: string): Promise<TicketIdentity | null> {
  if (!isLaunchTicket(token)) return null;

  const claimed = await prisma.loginToken.updateMany({
    where: {
      token,
      status: "CONFIRMED",
      browserNonceHash: null, // never accept a browser-flow token through this path
      telegramId: { not: null },
      expiresAt: { gt: new Date() },
    },
    data: { status: "CONSUMED" },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.loginToken.findUnique({ where: { token } });
  if (!row?.telegramId) return null;
  return {
    telegramId: row.telegramId,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    locale: row.locale,
  };
}
