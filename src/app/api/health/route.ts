import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaConfigured } from "@/lib/media";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Readiness probe + dependency status for uptime monitors and quick diagnosis.
 * 200 when the DB is reachable, 503 otherwise. Also reports media/email config and
 * whether pg_trgm (fuzzy search) is installed.
 */
export async function GET() {
  let db: "up" | "down" = "down";
  let trgm = false;
  let vector = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'vector')`;
    trgm = rows.some((r) => r.extname === "pg_trgm");
    vector = rows.some((r) => r.extname === "vector");
  } catch {
    db = "down";
  }

  const healthy = db === "up";
  return NextResponse.json(
    {
      ok: healthy,
      data: {
        status: healthy ? "ok" : "degraded",
        db,
        trgm,
        vector,
        semantic: vector && Boolean(process.env.VOYAGE_API_KEY),
        media: mediaConfigured(),
        privateMedia: Boolean(process.env.S3_PRIVATE_BUCKET),
        email: emailConfigured(),
        ai: Boolean(process.env.ANTHROPIC_API_KEY),
        version: process.env.APP_VERSION ?? "dev",
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
