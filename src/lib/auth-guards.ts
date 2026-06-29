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
  if (!user.onboardingCompleted && user.role !== "ADMIN") {
    redirect({ href: "/onboarding", locale });
    throw new Error("unreachable");
  }
  return user;
}
