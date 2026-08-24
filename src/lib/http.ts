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
 * All origins the app is served from. APP_ORIGIN is canonical; APP_EXTRA_ORIGINS
 * (comma-separated) covers a domain transition window (e.g. gigora.ai while
 * freelanceai.aicreator.academy remains canonical). Both are deploy-time config,
 * never request-derived.
 */
function trustedOrigins(request: Request): string[] {
  const origins = [getAppOrigin(request)];
  for (const raw of (process.env.APP_EXTRA_ORIGINS ?? "").split(",")) {
    const v = raw.trim();
    if (!v) continue;
    try {
      origins.push(new URL(v).origin);
    } catch {
      // ignore malformed entries
    }
  }
  return origins;
}

/**
 * Defense-in-depth CSRF check for state-changing POST routes: require the
 * Origin (or Referer) header to match one of our trusted origins.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const trusted = trustedOrigins(request);
  if (origin) return trusted.includes(origin);

  // Some browsers omit Origin on same-origin POSTs; fall back to Referer.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return trusted.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  // No Origin and no Referer: reject to be safe.
  return false;
}
