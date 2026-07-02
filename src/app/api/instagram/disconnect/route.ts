import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { disconnectInstagram } from "@/server/services/instagram-sync";

/** Disconnect Instagram: drops the token and deletes all synced portfolio items. */
export const POST = defineHandler({ auth: true }, async ({ user }) => {
  if (!user) throw Errors.unauthenticated();
  await disconnectInstagram(user.id);
  await audit({ actorId: user.id, action: "instagram.disconnect", entity: "SellerProfile", entityId: user.id });
  return ok({ done: true });
});
