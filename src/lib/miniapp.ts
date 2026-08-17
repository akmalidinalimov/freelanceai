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

/** Session cookie that carries the marker across in-app navigations once the param is gone. */
export const MINIAPP_COOKIE = "gigora_tgapp";

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
