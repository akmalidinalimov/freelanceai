import { NextResponse } from "next/server";
import { signOut } from "@/auth";
import { appUrl, isSameOrigin } from "@/lib/http";
import {
  NO_AUTOLOGIN_COOKIE,
  NO_AUTOLOGIN_MAX_AGE,
  crossSiteCookieOptions,
  isSecureRequest,
} from "@/lib/miniapp";

export async function POST(request: Request) {
  // CSRF defense-in-depth: only accept same-origin logout requests.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await signOut({ redirect: false });
  const res = NextResponse.redirect(appUrl(request, "/"), { status: 303 });
  // Tell the Mini App bootstrap to stand down for a few minutes. Without this it re-signs the user
  // in from initData on the very next page load — which is this redirect — so logout was a control
  // that cleared a session and recreated it before anyone could see.
  //
  // Cross-site attributes for the same reason the auth cookies need them: inside Telegram this is a
  // third-party context, and a Lax cookie would never be sent back, making the suppression invisible
  // exactly where it is needed.
  res.cookies.set(NO_AUTOLOGIN_COOKIE, "1", {
    httpOnly: false, // the bootstrap is client-side and has to read it
    path: "/",
    maxAge: NO_AUTOLOGIN_MAX_AGE,
    ...crossSiteCookieOptions(isSecureRequest(request)),
  });
  return res;
}
