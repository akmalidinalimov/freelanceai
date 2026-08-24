import { errorResponse, Errors } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { canAccessConversation, conversationHasFile } from "@/server/services/message";
import { resolveStoredFile, getObject } from "@/lib/media";

/**
 * Access-controlled download proxy for a conversation's chat attachments. Only the thread's
 * participants (buyer/seller/admin) may fetch, and only files actually attached to a message
 * in that conversation — so chat files can live in the PRIVATE bucket with no public URL.
 * Resolves both private refs and legacy public URLs (pre-private-bucket messages).
 * Inline disposition so <img>/<a> render in the thread.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const url = new URL(request.url).searchParams.get("u");
    if (!url) throw Errors.validation({ u: "missing" });

    if (!(await canAccessConversation(id, user))) throw Errors.notFound("Conversation not found");
    if (!(await conversationHasFile(id, url))) throw Errors.forbidden("File is not part of this conversation");

    const resolved = resolveStoredFile(url);
    const obj = resolved ? await getObject(resolved.key, resolved.bucket) : null;
    if (!obj) throw Errors.notFound("File not found");

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
