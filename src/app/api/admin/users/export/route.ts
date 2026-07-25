import { errorResponse, Errors } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import {
  exportUsersForAdmin,
  type AdminKycFilter,
  type AdminUserSegment,
} from "@/server/services/admin-users";

/** RFC-4180 escaping: quote when the value contains a comma, quote, or newline. */
function csv(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SEGMENTS = new Set(["all", "buyers", "sellers", "pending", "suspended"]);
const KYC = new Set(["NONE", "PENDING", "VERIFIED", "REJECTED"]);

/** CSV export of the CURRENT filter (same params as the list page). Capped at 5000 rows. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);

    const sp = new URL(request.url).searchParams;
    const segment = sp.get("segment") ?? undefined;
    const kyc = sp.get("kyc") ?? undefined;
    const rows = await exportUsersForAdmin({
      q: sp.get("q") ?? undefined,
      segment: segment && SEGMENTS.has(segment) ? (segment as AdminUserSegment) : undefined,
      kyc: kyc && KYC.has(kyc) ? (kyc as AdminKycFilter) : undefined,
      flagged: sp.get("flagged") === "1",
    });

    const header = [
      "id", "name", "username", "email", "telegram_id", "role", "is_seller", "approval_status",
      "kyc", "status", "orders", "sales", "gigs", "flags", "created_at", "last_seen_at",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id, r.name, r.username, r.email, r.telegramId,
          r.role, r.isSeller ? "yes" : "no", r.approvalStatus ?? "",
          r.kycStatus, r.status, r.orders, r.sales, r.gigs, r.flags,
          r.createdAt.toISOString(), r.lastSeenAt ? r.lastSeenAt.toISOString() : "",
        ].map(csv).join(",")
      );
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gigora-users-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
