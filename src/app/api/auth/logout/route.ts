import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { appUrl, isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  // CSRF defense-in-depth: only accept same-origin logout requests.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await destroySession();
  return NextResponse.redirect(appUrl(request, "/"), { status: 303 });
}
