import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { updateOwnProfile } from "@/server/services/profile";

const schema = z
  .object({
    headline: z.string().max(120).optional(),
    bio: z.string().max(600).optional(),
    skills: z.array(z.string().min(1).max(40)).max(20).optional(),
    aiTools: z.array(z.string().min(1).max(40)).max(20).optional(),
    specializations: z.array(z.string().min(1).max(40)).max(30).optional(),
    instagramUsername: z.string().max(40).optional(),
    telegramChannel: z.string().max(120).optional(),
    telegramPosts: z.array(z.string().max(200)).max(12).optional(),
    bannerUrl: z.string().max(500).nullable().optional(),
    bannerType: z.enum(["image", "video"]).optional(),
    bannerPosterUrl: z.string().max(500).nullable().optional(),
  })
  .strict();

/** Update the caller's own seller profile. */
export const PATCH = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  await updateOwnProfile(user.id, body);
  return ok({ done: true });
});
