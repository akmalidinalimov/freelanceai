import { cookies } from "next/headers";
import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { referrerIdForCode } from "@/server/services/referral";

const schema = z.object({ code: z.string().min(1).max(16) });

/**
 * Capture a shared referral code (`?ref=CODE`) into the `ref` cookie — the same cookie
 * `/r/[code]` sets — so it survives until signup, when attribution is applied. First-touch
 * wins (we don't overwrite an existing cookie), and an unknown code is a silent no-op.
 */
export const POST = defineHandler({ schema }, async ({ body }) => {
  const jar = await cookies();
  if (jar.get("ref")) return ok({ captured: false });
  const referrerId = await referrerIdForCode(body.code).catch(() => null);
  if (!referrerId) return ok({ captured: false });
  jar.set("ref", referrerId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return ok({ captured: true });
});
