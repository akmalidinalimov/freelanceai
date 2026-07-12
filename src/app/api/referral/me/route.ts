import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { getReferralInfo } from "@/server/services/referral";

/** The current user's referral code (for building share links). Null when logged out. */
export const GET = defineHandler({}, async ({ user }) => {
  if (!user) return ok({ code: null });
  const { code } = await getReferralInfo(user.id);
  return ok({ code });
});
