import "server-only";
import { logger } from "@/lib/logger";

/**
 * Minimal Gemini client for multimodal review. Gemini is used ONLY for pixels and
 * sound (portfolio images, and video natively — including its audio track, which is
 * what lets a voiceover gig be judged at all). Text generation stays on Claude, which
 * already drafts gigs and parses search intent.
 *
 * Deliberate choices:
 *  - temperature 0 + responseSchema: scoring must be repeatable, not creative.
 *  - inline base64 parts: portfolio files are small and public; the resumable File API
 *    would add a second round-trip for no benefit at this size.
 *  - fail-closed to null on ANY problem. A missing review must never approve or reject
 *    a seller by accident — it just leaves the case for a human.
 */

const MODEL = "gemini-2.5-flash";
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const TIMEOUT_MS = 90_000; // video takes real time to process
const MAX_INLINE_BYTES = 18 * 1024 * 1024; // keep the request comfortably under limits

export interface MediaPart {
  mimeType: string;
  /** base64 (no data: prefix) */
  data: string;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Fetch a public media URL into an inline part. Returns null when unusable. */
export async function fetchInlinePart(url: string): Promise<MediaPart | null> {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_INLINE_BYTES) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    if (!/^(image|video|audio)\//.test(mimeType)) return null;
    return { mimeType, data: Buffer.from(ab).toString("base64") };
  } catch {
    return null;
  }
}

/**
 * One structured multimodal call. `schema` is a JSON Schema for the response; Gemini
 * is constrained to it, so the caller gets typed data instead of prose to parse.
 * Returns null on any failure (no key, timeout, refusal, malformed output).
 */
export async function geminiJson<T>(opts: {
  system: string;
  prompt: string;
  media?: MediaPart[];
  schema: Record<string, unknown>;
  model?: string;
}): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = opts.model ?? MODEL;

  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const m of opts.media ?? []) {
    parts.push({ inline_data: { mime_type: m.mimeType, data: m.data } });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
    if (!res.ok) {
      logger.warn("gemini_http_error", { status: res.status, model });
      return null;
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (e) {
    logger.warn("gemini_failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const GEMINI_MODEL = MODEL;
