import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * CSP violation collector. Browsers POST here (report-uri/report-to) when the
 * Report-Only policy would have blocked something. We log the actionable fields so
 * we can craft the eventual enforced policy from real traffic. Rate-limited so a
 * misbehaving page can't flood the logs.
 */
export async function POST(request: Request) {
  if (!rateLimit(`csp:${clientIp(request)}`, 30, 60_000)) {
    return new NextResponse(null, { status: 429 });
  }
  try {
    const payload = (await request.json().catch(() => null)) as
      | { "csp-report"?: Record<string, unknown> }
      | Array<{ body?: Record<string, unknown> }>
      | null;

    // report-uri sends { "csp-report": {...} }; report-to sends an array of { body }.
    const reports = Array.isArray(payload)
      ? payload.map((r) => r.body ?? {})
      : payload?.["csp-report"]
        ? [payload["csp-report"]]
        : [];

    for (const r of reports) {
      logger.warn("csp_violation", {
        directive: r["violated-directive"] ?? r["effectiveDirective"] ?? null,
        blocked: r["blocked-uri"] ?? r["blockedURL"] ?? null,
        document: r["document-uri"] ?? r["documentURL"] ?? null,
      });
    }
  } catch {
    /* ignore malformed reports */
  }
  // Browsers ignore the body; 204 keeps it cheap.
  return new NextResponse(null, { status: 204 });
}
