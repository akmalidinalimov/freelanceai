import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { deleteOwnAccount } from "@/server/services/account";

const schema = z.object({ confirm: z.literal("DELETE") }).strict();

/**
 * Account deletion (anonymize-and-close). Requires typed confirmation; refused
 * while orders are active or a seller balance is withdrawable. Sessions are
 * destroyed in the process — the client should redirect to the home page.
 */
export const POST = defineHandler({ auth: true, schema }, async ({ user }) => {
  if (!user) throw Errors.unauthenticated();
  enforceRateLimit(`account-delete:${user.id}`, 3, 60_000);
  await deleteOwnAccount(user);
  return ok({ deleted: true });
});
