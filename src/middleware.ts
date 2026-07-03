import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Gigora cutover: 301 the legacy host → gigora.ai when REDIRECT_LEGACY_HOST=1.
// STAGED OFF by default. Do NOT enable before the Google OAuth redirect URI for
// gigora.ai is added — a legacy-host Google login would bounce to gigora.ai where
// the callback isn't yet allow-listed and fail. Activation: set the repo build-var
// REDIRECT_LEGACY_HOST=1, redeploy. Does not import auth → keeps middleware
// edge-safe (auth.ts can still use node-only imports).
const LEGACY_HOST = "freelanceai.aicreator.academy";
const CANONICAL_ORIGIN = "https://gigora.ai";

export default function middleware(request: NextRequest) {
  if (process.env.REDIRECT_LEGACY_HOST === "1") {
    const host = request.headers.get("host") ?? "";
    if (host === LEGACY_HOST) {
      const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
      return NextResponse.redirect(dest, 301);
    }
  }
  return intlMiddleware(request);
}

export const config = {
  // Match all paths except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
