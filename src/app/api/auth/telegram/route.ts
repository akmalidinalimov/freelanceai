import { NextResponse } from "next/server";
import { verifyLoginWidget } from "@/lib/telegram";
import { upsertTelegramUser, createSession } from "@/lib/session";
import { appUrl } from "@/lib/http";

// The redirect-mode callback URL is short-lived; reject payloads older than this
// to limit replay if the URL leaks (history, logs, referer).
const LOGIN_MAX_AGE_SECONDS = 60;

/**
 * Telegram Login Widget callback (redirect mode).
 * The widget redirects the browser here with the signed user fields as query
 * params. We verify the signature server-side, then create a session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) data[k] = v;

  try {
    const tgUser = verifyLoginWidget(data, {
      maxAgeSeconds: LOGIN_MAX_AGE_SECONDS,
    });
    if (!tgUser) {
      return NextResponse.redirect(appUrl(request, "/login?error=auth"));
    }

    const user = await upsertTelegramUser(tgUser);
    await createSession(user.id);

    return NextResponse.redirect(appUrl(request, "/"));
  } catch (err) {
    // Misconfiguration (e.g. missing bot token) or transient DB error — never
    // leak a stack trace to the browser; log and send the user back to login.
    console.error("Telegram auth callback failed:", err);
    return NextResponse.redirect(appUrl(request, "/login?error=auth"));
  }
}
