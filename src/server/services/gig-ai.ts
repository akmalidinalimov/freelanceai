import "server-only";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * AI gig drafting — "answer a few questions → a fully structured gig draft."
 * Generates natively in the seller's language (uz/ru/en; validated Uzbek-Latin quality per the
 * S2 eval) into FIXED structured fields, so every gig comes out the same shape regardless of the
 * seller's writing ability. Never auto-publishes: the caller renders the draft into the editable
 * gig form. Fail-open — null on missing key / timeout / bad output; the caller then falls back to
 * a deterministic template built from the raw answers, so a seller can always proceed.
 */

const MODEL = "claude-haiku-4-5-20251001"; // cheap + fast; a gig draft is a one-shot, low volume
const TIMEOUT_MS = 12_000; // longer than search — this is a considered generation, not a keystroke
const GLOBAL_PER_MIN = 30; // global ceiling across all sellers
const DAILY_BUDGET_CALLS = 5_000; // hard breaker

export interface GigDraftInput {
  /** Plain service description the seller typed, e.g. "logo dizayn". */
  service: string;
  /** What they deliver, e.g. "3 ta logo varianti + manba fayllar". */
  deliverable: string;
  /** Turnaround in days for the base package. */
  days: number;
  /** Base (starting) price in UZS. */
  priceUzs: number;
  /** Optional "what makes yours good". */
  differentiator?: string;
}

export type Tier = "BASIC" | "STANDARD" | "PREMIUM";
export interface DraftPackage {
  tier: Tier;
  title: string;
  description: string;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}
export interface GigDraft {
  title: string;
  description: string;
  tags: string[];
  packages: DraftPackage[]; // exactly 3, monotonic price
  extras: { title: string; priceUzs: number }[];
  requirementPrompts: string[];
}

const clampInt = (n: unknown, min: number, max: number, fallback: number): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};
const clampStr = (s: unknown, max: number): string => (typeof s === "string" ? s.trim().slice(0, max) : "");

/**
 * Guardrail: coerce ANY model output into a valid, consistent draft — exactly 3 monotonically
 * priced tiers, prices ≥ 1000, days ≥ 1, bounded lengths — synthesizing sane values from the
 * seller's base answers when the model omits or mangles a field. Pure → unit-tested.
 */
export function clampGigDraft(raw: Partial<GigDraft> | null | undefined, input: GigDraftInput): GigDraft {
  const base = Math.max(1000, clampInt(input.priceUzs, 1000, 1_000_000_000, 1000));
  const baseDays = clampInt(input.days, 1, 365, 3);

  const rawPkgs = Array.isArray(raw?.packages) ? raw!.packages! : [];
  const byTier = (t: Tier) => rawPkgs.find((p) => p?.tier === t);
  // Default ladder if the model didn't give sane numbers: 1× / 1.8× / 3× price, +revisions/speed.
  const defaults: Record<Tier, { price: number; days: number; rev: number }> = {
    BASIC: { price: base, days: baseDays, rev: 1 },
    STANDARD: { price: Math.round(base * 1.8), days: baseDays, rev: 2 },
    PREMIUM: { price: Math.round(base * 3), days: Math.max(1, Math.round(baseDays * 0.8)), rev: 3 },
  };
  const tiers: Tier[] = ["BASIC", "STANDARD", "PREMIUM"];
  let lastPrice = 0;
  const packages: DraftPackage[] = tiers.map((tier) => {
    const p = byTier(tier);
    const d = defaults[tier];
    let priceUzs = clampInt(p?.priceUzs, 1000, 1_000_000_000, d.price);
    // Enforce monotonic pricing across tiers (Basic ≤ Standard ≤ Premium).
    if (priceUzs <= lastPrice) priceUzs = Math.round(lastPrice * 1.5) || d.price;
    lastPrice = priceUzs;
    return {
      tier,
      title: clampStr(p?.title, 60) || tier,
      // Fall back to the seller's own deliverable text for the base tier when the model omits it.
      description: clampStr(p?.description, 300) || (tier === "BASIC" ? clampStr(input.deliverable, 300) : ""),
      priceUzs,
      deliveryDays: clampInt(p?.deliveryDays, 1, 365, d.days),
      revisions: clampInt(p?.revisions, 0, 20, d.rev),
    };
  });

  const tags = Array.isArray(raw?.tags)
    ? Array.from(new Set(raw!.tags!.map((t) => clampStr(t, 30).toLowerCase()).filter(Boolean))).slice(0, 10)
    : [];
  const extras = (Array.isArray(raw?.extras) ? raw!.extras! : [])
    .map((e) => ({ title: clampStr(e?.title, 60), priceUzs: clampInt(e?.priceUzs, 1000, 1_000_000_000, 10_000) }))
    .filter((e) => e.title)
    .slice(0, 6);
  const requirementPrompts = (Array.isArray(raw?.requirementPrompts) ? raw!.requirementPrompts! : [])
    .map((q) => clampStr(q, 200))
    .filter(Boolean)
    .slice(0, 8);

  return {
    title: clampStr(raw?.title, 80) || clampStr(input.service, 80),
    description: clampStr(raw?.description, 2000) || clampStr(input.deliverable, 2000),
    tags,
    packages,
    extras,
    requirementPrompts,
  };
}

/** A deterministic, no-AI fallback draft from the raw answers, so the seller can always proceed. */
export function templateGigDraft(input: GigDraftInput): GigDraft {
  return clampGigDraft(null, input);
}

let dayStamp = "";
let dailyCalls = 0;
function spendAllowed(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayStamp) {
    dayStamp = today;
    dailyCalls = 0;
  }
  if (dailyCalls >= DAILY_BUDGET_CALLS) return false;
  if (!rateLimit("gig-ai:global", GLOBAL_PER_MIN, 60_000)) return false;
  dailyCalls += 1;
  return true;
}

const LANG = { uz: "Uzbek (Latin script)", ru: "Russian", en: "English" } as const;

/** Generate a structured gig draft with Claude. Returns null on any failure (caller falls back). */
export async function generateGigDraft(input: GigDraftInput, locale: string): Promise<GigDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!spendAllowed()) return null;

  const lang = LANG[(locale as keyof typeof LANG) in LANG ? (locale as keyof typeof LANG) : "uz"];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system:
          `You write freelance-marketplace gig listings for first-time, often low-literacy freelancers in Uzbekistan. ` +
          `Write EVERYTHING in ${lang}, in a plain, simple, honest register — no marketing hype, no words the seller couldn't defend to a buyer. ` +
          `Produce a clean 3-tier package ladder (Basic/Standard/Premium) with rising price and value. ` +
          `Prices are in Uzbek soum (UZS); keep them realistic and monotonically increasing. ` +
          `Suggest 5-8 short search tags and 2-4 upsell extras and 2-4 short buyer requirement questions.`,
        tools: [
          {
            name: "draft_gig",
            description: "Return the structured gig draft",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                packages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tier: { type: "string", enum: ["BASIC", "STANDARD", "PREMIUM"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      priceUzs: { type: "number" },
                      deliveryDays: { type: "number" },
                      revisions: { type: "number" },
                    },
                    required: ["tier", "title", "priceUzs", "deliveryDays"],
                  },
                },
                extras: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { title: { type: "string" }, priceUzs: { type: "number" } },
                    required: ["title", "priceUzs"],
                  },
                },
                requirementPrompts: { type: "array", items: { type: "string" } },
              },
              required: ["title", "description", "packages"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "draft_gig" },
        messages: [
          {
            role: "user",
            content:
              `Service: ${input.service.slice(0, 200)}\n` +
              `What I deliver: ${input.deliverable.slice(0, 500)}\n` +
              `Turnaround: ${input.days} days\n` +
              `Starting price: ${input.priceUzs} UZS\n` +
              (input.differentiator ? `What makes mine good: ${input.differentiator.slice(0, 300)}\n` : ""),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
    const tool = data.content?.find((c) => c.type === "tool_use" && c.name === "draft_gig");
    if (!tool?.input) return null;
    return clampGigDraft(tool.input as Partial<GigDraft>, input);
  } catch (e) {
    logger.warn("gig_ai_draft_failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
