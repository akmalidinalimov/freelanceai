import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { instagramConfigured, authorizeUrl, signState } from "@/lib/instagram";

/** Start the Instagram Business Login flow (sellers only). Redirects to Instagram. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  if (!user.isSeller) return new Response("sellers only", { status: 403 });
  if (!instagramConfigured()) {
    // Feature-flagged by env; send the user back with a friendly marker.
    const back = new URL("/uz/dashboard/seller/profile?ig=unavailable", request.url);
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(authorizeUrl(signState(user.id)));
}
