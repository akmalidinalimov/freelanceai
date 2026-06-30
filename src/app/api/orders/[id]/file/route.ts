import { errorResponse, Errors } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { getOrderForUser } from "@/server/services/order";
import { resolveStoredFile, getObject } from "@/lib/media";

/**
 * Access-controlled download proxy for an order's delivery files. Only the order's
 * participants (buyer/seller/admin) may fetch, and only files actually attached to one of
 * the order's deliveries — the raw object URL is never exposed in the page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const url = new URL(request.url).searchParams.get("u");
    if (!url) throw Errors.validation({ u: "missing" });

    const order = await getOrderForUser(id, user).catch(() => null);
    if (!order) throw Errors.notFound("Order not found");

    const allowed =
      order.deliveries.some((d) => d.fileUrls.includes(url)) ||
      order.requirementFileUrls.includes(url);
    if (!allowed) throw Errors.forbidden("File is not part of this order");

    const resolved = resolveStoredFile(url);
    const obj = resolved ? await getObject(resolved.key, resolved.bucket) : null;
    if (!obj) throw Errors.notFound("File not found");

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.contentType,
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
