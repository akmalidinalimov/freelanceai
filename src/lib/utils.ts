import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Validate a login-return path (`?next=`): same-origin RELATIVE paths only.
 * Rejects absolute URLs, protocol-relative "//host", backslash tricks, and
 * anything not starting with a single "/" — callers fall back to home.
 */
export function safeInternalPath(p: string | null | undefined): string | null {
  if (!p || p.length > 500) return null;
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  // Reject backslashes and ALL C0/DEL control chars. Critical: the WHATWG URL
  // parser strips tab/LF/CR from a URL before parsing, so "/\t/evil.com" would
  // otherwise pass the "//" check here and collapse to "//evil.com" (a
  // protocol-relative open redirect) at navigation time.
  if (p.includes("\\") || /[\u0000-\u001F\u007F]/.test(p)) return null;
  return p;
}

/** Merge Tailwind class names safely (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an integer UZS amount (no decimals) for display, e.g. 150000 -> "150 000".
 * Deterministic, ICU-independent grouping with a non-breaking space: `Intl` with a
 * locale can disagree between Node and the browser (Node "uz-UZ" grouped with a space,
 * Chrome with a comma), which produced a React hydration mismatch (#418) and an
 * inconsistent separator across the UI. Manual grouping is identical everywhere.
 */
export function formatUzs(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
