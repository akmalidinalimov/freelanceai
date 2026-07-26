import "server-only";
import type { User } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { safeInternalPath } from "@/lib/utils";

/**
 * The path the visitor asked for (set by middleware as x-pathname), validated as an
 * internal path. Used so a login bounce can send them back where they were headed —
 * critical inside a Telegram Mini App, whose WebView starts with no session and
 * auto-authenticates a moment later.
 */
async function currentPath(): Promise<string | null> {
  try {
    const h = await headers();
    return safeInternalPath(h.get("x-pathname"));
  } catch {
    return null;
  }
}

/** Build the login href, preserving the intended destination when we know it. */
async function loginHref(): Promise<string> {
  const next = await currentPath();
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/**
 * Page guard for authenticated app routes: must be signed in AND onboarded.
 * Not signed in → /login (carrying ?next= so the Mini App bootstrap can return).
 * Admins are always treated as onboarded. Redirects are locale-aware and built
 * only from internal paths (no open-redirect).
 */
export async function requireOnboardedUser(locale: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: await loginHref(), locale });
    throw new Error("unreachable"); // redirect throws; narrows for TS
  }
  // Fiverr-style: everyone is a buyer immediately; no forced onboarding gate.
  // Selling is the opt-in `isSeller` capability ("Become a creator").
  return user;
}

/** Creator-only page: non-sellers (non-admins) are sent to the buyer dashboard. */
export async function requireSellerUser(locale: string): Promise<User> {
  const user = await requireOnboardedUser(locale);
  if (!user.isSeller && user.role !== "ADMIN") {
    redirect({ href: "/dashboard", locale });
    throw new Error("unreachable");
  }
  return user;
}

/** Admin-only page: non-admins are sent to the buyer dashboard (no existence leak). */
export async function requireAdminUser(locale: string): Promise<User> {
  const user = await requireOnboardedUser(locale);
  if (user.role !== "ADMIN") {
    redirect({ href: "/dashboard", locale });
    throw new Error("unreachable");
  }
  return user;
}
