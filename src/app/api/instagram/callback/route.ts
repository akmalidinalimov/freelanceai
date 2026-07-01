import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { encryptPII } from "@/lib/pii-crypto";
import { readCookie } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { instagramConfigured, exchangeCode, verifyState, fetchMedia } from "@/lib/instagram";
import { syncInstagramForSeller } from "@/server/services/instagram-sync";

/**
 * Instagram OAuth redirect target. Validates the HMAC state (must match the logged-in
 * user), exchanges the code for a long-lived token (stored encrypted), records the IG
 * identity, and runs the first sync. Always redirects back to the profile editor.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Preserve the user's locale (next-intl cookie) instead of hardcoding /uz.
  const cookieLocale = readCookie(request, "NEXT_LOCALE");
  const loc = cookieLocale === "ru" || cookieLocale === "en" ? cookieLocale : "uz";
  const back = (marker: string) =>
    NextResponse.redirect(new URL(`/${loc}/dashboard/seller/profile?ig=${marker}`, url.origin));

  if (!instagramConfigured()) return back("unavailable");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/${loc}/login`, url.origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const stateUser = verifyState(state);
  if (!code || !stateUser || stateUser !== user.id) return back("error");

  try {
    const { accessToken, igUserId, expiresAt } = await exchangeCode(code);
    // Capture the handle for the profile chip (best effort).
    const username = (await fetchMedia(accessToken, 1).catch(() => []))[0]?.username ?? null;
    await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        instagramUserId: igUserId,
        instagramTokenEnc: encryptPII(accessToken),
        instagramTokenExpiresAt: expiresAt,
        ...(username ? { instagramUsername: username } : {}),
      },
      update: {
        instagramUserId: igUserId,
        instagramTokenEnc: encryptPII(accessToken),
        instagramTokenExpiresAt: expiresAt,
        ...(username ? { instagramUsername: username } : {}),
      },
    });
    await audit({ actorId: user.id, action: "instagram.connect", entity: "SellerProfile", entityId: user.id });
    await syncInstagramForSeller(user.id).catch(() => {});
    return back("connected");
  } catch {
    return back("error");
  }
}
