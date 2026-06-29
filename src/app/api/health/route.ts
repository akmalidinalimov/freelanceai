import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for uptime monitors. Reports DB connectivity.
 * 200 when healthy, 503 when the database is unreachable.
 */
export async function GET() {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }

  const healthy = db === "up";
  return NextResponse.json(
    { ok: healthy, data: { status: healthy ? "ok" : "degraded", db } },
    { status: healthy ? 200 : 503 }
  );
}
