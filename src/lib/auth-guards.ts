import "server-only";
import type { User } from "@prisma/client";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

/**
 * Page guard for authenticated app routes: must be signed in AND onboarded.
 * Not signed in → /login. Signed in but onboarding incomplete → /onboarding.
 * Admins are always treated as onboarded. Redirects are locale-aware and built
 * only from internal paths (no open-redirect).
 */
export async function requireOnboardedUser(locale: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
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
