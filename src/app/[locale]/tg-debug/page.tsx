import { TgDebugClient } from "@/components/tg-debug-client";

/**
 * One-tap diagnostic for Telegram Mini App launches.
 *
 * Two different faults produce the SAME screen (our chrome visible + a login prompt): the marker
 * never arriving, and initData being empty. They need opposite fixes, and neither is visible from
 * a desktop browser — Telegram's own client is the only place the truth exists. Rather than guess
 * again, this reports what the client actually sees.
 *
 * Reached from the admin-only /tgdebug bot command. Renders nothing sensitive: a boolean, a
 * length, and Telegram's own platform strings. The initData VALUE is never shown or sent.
 */
export default function TgDebugPage() {
  return <TgDebugClient />;
}
