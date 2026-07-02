import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { exportOwnData } from "@/server/services/account";

/** Data portability: everything we hold about the caller, as JSON. */
export const GET = defineHandler({ auth: true }, async ({ user }) => {
  if (!user) throw Errors.unauthenticated();
  enforceRateLimit(`export:${user.id}`, 5, 60_000);
  const data = await exportOwnData(user.id);
  return ok(data);
});
