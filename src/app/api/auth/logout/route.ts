import { NextResponse } from "next/server";
import { signOut } from "@/auth";
import { appUrl, isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  // CSRF defense-in-depth: only accept same-origin logout requests.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await signOut({ redirect: false });
  return NextResponse.redirect(appUrl(request, "/"), { status: 303 });
}
