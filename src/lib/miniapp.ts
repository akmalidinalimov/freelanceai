/**
 * Telegram Mini App context detection.
 *
 * Inside Telegram we hide our own chrome (header, footer, bottom nav, cookie banner) because
 * Telegram draws its own. The catch is that getting this WRONG is not cosmetic: a page with our
 * chrome hidden AND no Telegram controls has no navigation at all, so the user is stuck.
 *
 * Hence a two-signal contract, deliberately asymmetric:
 *
 *   server  — optimistic. A marker (query param on bot links, then a cookie) suppresses chrome on
 *             the FIRST paint, so there is no flash of web chrome on launch.
 *   client  — authoritative. After hydration, TelegramChrome checks for the real SDK. No SDK means
 *             the marker was wrong (stale cookie, or a ?tgapp=1 URL someone copied and shared), so
 *             it restores the chrome and clears the cookie.
 *
 * Worst case is therefore one frame without a header, never a dead end.
 * See docs/superpowers/specs/2026-08-11-telegram-miniapp-shell-design.md §1.
 */

/** Query param the bot appends to every Mini App link. Stripped by middleware after one hop. */
export const MINIAPP_PARAM = "tgapp";

/** Cookie that carries the marker across in-app navigations, and across relaunches. */
export const MINIAPP_COOKIE = "gigora_tgapp";

/** 30 days. A session cookie would die with the WebView, so every relaunch would flash chrome. */
export const MINIAPP_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Cookie attributes for anything that must survive inside Telegram.
 *
 * Telegram Desktop and Telegram Web run a Mini App in an IFRAME on telegram.org (our CSP grants
 * exactly that: `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`). A
 * cross-site iframe never receives `SameSite=Lax` cookies — verified against production: framed
 * from telegram.org, gigora.ai got no Cookie header at all. So a Lax session cookie is written on
 * login and never sent again, which is why a signed-in user was logged out on the next launch.
 *
 * `SameSite=None` makes the cookie cross-site capable; `Partitioned` (CHIPS) keeps it keyed to the
 * embedding top-level site, so the Mini App jar is separate from the plain-web jar and the cookie
 * survives third-party-cookie deprecation.
 *
 * Both REQUIRE Secure, and a browser DROPS `SameSite=None` without it. So this keys off the actual
 * request protocol, never NODE_ENV: Playwright runs `next start`, which forces NODE_ENV=production
 * while serving plain http://localhost, and a NODE_ENV check would emit a cookie every local
 * browser silently discards.
 */
export function crossSiteCookieOptions(isSecure: boolean) {
  return isSecure
    ? ({ sameSite: "none", secure: true, partitioned: true } as const)
    : ({ sameSite: "lax", secure: false, partitioned: false } as const);
}

/** True when this request is really being served over HTTPS (honours the proxy header). */
export function isSecureRequest(req: {
  nextUrl?: { protocol?: string };
  headers: { get(name: string): string | null };
}): boolean {
  const fwd = req.headers.get("x-forwarded-proto");
  if (fwd) return fwd.split(",")[0].trim() === "https";
  return req.nextUrl?.protocol === "https:";
}

/**
 * True when the browser says THIS document is being framed cross-site — i.e. Telegram Desktop or
 * Telegram Web is embedding us on telegram.org.
 *
 * This exists to break a circular dependency that silently broke every Mini App sign-in. Auth
 * cookies only get cross-site attributes when the marker cookie is already present, but on a first
 * launch it is not — and measured against production, that means `__Host-authjs.csrf-token` is
 * issued `SameSite=Lax`, which the iframe can never send back, so `signIn()` fails its CSRF check
 * with no error the user can see.
 *
 * Fetch Metadata resolves it because these headers arrive on the very first DOCUMENT request,
 * before any cookie exists. Middleware turns that into the marker, and every later `/api/auth/*`
 * call carries it. Note the limitation this is designed around: the sign-in POST itself is a
 * same-origin fetch from inside the iframe (`Sec-Fetch-Site: same-origin`), so these headers can
 * never classify THAT request — only the navigation that precedes it.
 *
 * Only ever used to widen cookie attributes and to suppress our own chrome. Never to authorize.
 * Spoofing it grants nothing: `Sec-Fetch-*` is browser-set and forbidden to scripts, and the worst
 * a forged value achieves is a cookie the sender could already obtain by adding `?tgapp=1`.
 */
export function isFramedCrossSite(headers: { get(name: string): string | null }): boolean {
  const dest = headers.get("sec-fetch-dest");
  const site = headers.get("sec-fetch-site");
  if (dest !== "iframe" && dest !== "nested-document") return false;
  return site === "cross-site" || site === "same-site";
}

/** Header the middleware sets so Server Components (which cannot read cookies mid-render) see it. */
export const MINIAPP_HEADER = "x-gigora-miniapp";

/**
 * Locale-stripped paths where Telegram's BackButton should be hidden: there is nowhere useful to
 * go back to, and offering a back button that exits the app is worse than offering none. Kept
 * here rather than in the component so it cannot drift from the nav's own idea of "root".
 */
export const MINIAPP_ROOT_PATHS = ["/", "/gigs", "/search", "/orders", "/messages", "/dashboard"];

/** True when the request carries the Mini App marker (param or cookie). Server-side only. */
export function isMiniAppRequest(headers: { get(name: string): string | null }): boolean {
  return headers.get(MINIAPP_HEADER) === "1";
}

/** True when `pathname` is a root screen, ignoring the locale prefix. */
export function isRootPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(uz|ru|en)(?=\/|$)/, "") || "/";
  return MINIAPP_ROOT_PATHS.includes(withoutLocale);
}
