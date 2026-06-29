import "server-only";

/**
 * The trusted application origin. Redirects are built from this (NOT from the
 * incoming request host, which is attacker-influenceable behind a proxy).
 */
export function getAppOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to request-derived origin
    }
  }
  return new URL(request.url).origin;
}

/** Build an absolute URL on the trusted origin from a relative path. */
export function appUrl(request: Request, path: string): URL {
  return new URL(path, getAppOrigin(request));
}

/**
 * Defense-in-depth CSRF check for state-changing POST routes: require the
 * Origin (or Referer) header to match our trusted origin.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const trusted = getAppOrigin(request);
  if (origin) return origin === trusted;

  // Some browsers omit Origin on same-origin POSTs; fall back to Referer.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === trusted;
    } catch {
      return false;
    }
  }
  // No Origin and no Referer: reject to be safe.
  return false;
}
