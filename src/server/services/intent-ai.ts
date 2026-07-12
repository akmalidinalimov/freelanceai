import "server-only";
import { SPECIALIZATIONS, specLabel } from "@/lib/specializations";
import { rateLimit } from "@/lib/rate-limit";
import type { Intent } from "@/server/services/match";

/**
 * S3 — Claude-powered intent parse (docs/search-ai-spec.md §4 step 2).
 * Turns a free-text brief ("I need someone to make clothing reels for my shop")
 * into taxonomy keys + expanded uz/ru/en lexical terms + a one-line "understood"
 * echo. Fail-open by design: null on missing key / timeout / bad output, and the
 * caller falls back to the deterministic lexical parser. Results are cached
 * (identical queries are common from the homepage examples).
 */

export interface AiIntent extends Intent {
  understood?: string;
}

const MODEL = "claude-haiku-4-5-20251001"; // cheap + fast; parse budget is ~600ms
const TIMEOUT_MS = 2500;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Transient upstream failures (429/5xx/truncation) get a SHORT negative TTL — a blip
// must not pin a popular query (homepage examples!) to keyword-only for 6 hours.
const NEGATIVE_TTL_MS = 2 * 60 * 1000;
// Spend guards: per-IP limits alone leave ~$2k/hour open to a distributed rotator.
const GLOBAL_PER_MIN = 60; // global ceiling across ALL users
const DAILY_BUDGET_CALLS = 20_000; // ≈ $80/day worst case — hard breaker
// Outage breaker: after N consecutive network failures skip Claude entirely for a
// cooldown, so an Anthropic outage costs one 2.5s timeout per minute, not per search.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60 * 1000;

const VALID_KEYS = new Set(SPECIALIZATIONS.map((s) => s.key));

let dayStamp = "";
let dailyCalls = 0;
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function spendAllowed(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayStamp) {
    dayStamp = today;
    dailyCalls = 0;
  }
  if (dailyCalls >= DAILY_BUDGET_CALLS) return false;
  if (!rateLimit("intent-ai:global", GLOBAL_PER_MIN, 60_000)) return false;
  dailyCalls += 1;
  return true;
}

// Compact taxonomy for the prompt: key → labels (uz|ru|en) so Claude maps
// multilingual briefs onto canonical keys instead of inventing its own.
const TAXONOMY = SPECIALIZATIONS.map((s) => `${s.key} (${s.kind}): ${s.uz} | ${s.ru} | ${s.en}`).join("\n");

const cache = new Map<string, { at: number; value: AiIntent | null }>();

function cacheKey(query: string, locale: string): string {
  return `${locale}:${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export async function parseIntentWithClaude(query: string, locale: string): Promise<AiIntent | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const key = cacheKey(query, locale);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value === null ? NEGATIVE_TTL_MS : CACHE_TTL_MS)) {
    return hit.value;
  }
  if (Date.now() < breakerOpenUntil) return null; // upstream outage — skip, fail open
  if (!spendAllowed()) return null; // global/day budget exhausted — keyword-only

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: `You parse marketplace search briefs for an Uzbekistan AI-creative marketplace (languages: Uzbek, Russian, English). Map the brief onto this controlled taxonomy — use ONLY these keys:\n${TAXONOMY}\n\nRules: pick every key that clearly applies (skills = what to make, niches = the client's industry); expandedTerms are 5-15 short search words/synonyms across uz+ru+en that a matching gig might contain (lowercase, no duplicates of the query's own words only — including them is fine); "understood" is ONE short sentence in the ${locale} language restating what the buyer needs. If the brief is gibberish or not a service request, return empty arrays.`,
        tools: [
          {
            name: "report_intent",
            description: "Report the parsed search intent",
            input_schema: {
              type: "object",
              properties: {
                specKeys: { type: "array", items: { type: "string" } },
                expandedTerms: { type: "array", items: { type: "string" } },
                understood: { type: "string" },
              },
              required: ["specKeys", "expandedTerms", "understood"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "report_intent" },
        messages: [{ role: "user", content: query.slice(0, 300) }],
      }),
    });
    if (!res.ok) {
      console.error("intent-ai: anthropic status", res.status);
      cache.set(key, { at: Date.now(), value: null }); // short TTL via NEGATIVE_TTL_MS
      return null;
    }
    consecutiveFailures = 0;
    const data = (await res.json()) as {
      content?: Array<{ type: string; input?: { specKeys?: unknown; expandedTerms?: unknown; understood?: unknown } }>;
    };
    const tool = data.content?.find((c) => c.type === "tool_use");
    const input = tool?.input;
    if (!input) {
      // Truncated/malformed tool output — negative-cache so the same query doesn't
      // pay a fresh (likely also-truncated) call on every search.
      cache.set(key, { at: Date.now(), value: null });
      return null;
    }

    const specKeys = (Array.isArray(input.specKeys) ? input.specKeys : [])
      .filter((k): k is string => typeof k === "string" && VALID_KEYS.has(k))
      .slice(0, 8);
    const terms = (Array.isArray(input.expandedTerms) ? input.expandedTerms : [])
      .filter((t): t is string => typeof t === "string" && t.length >= 2 && t.length <= 40)
      .map((t) => t.toLowerCase().trim())
      .slice(0, 20);
    const understood =
      typeof input.understood === "string" && input.understood.length <= 200
        ? input.understood.trim()
        : undefined;

    const value: AiIntent = {
      terms: [...new Set(terms)],
      specKeys,
      specLabels: specKeys.map((k) => specLabel(k, locale)),
      understood,
    };
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // Timeout/network — degrade to the lexical parser. Consecutive failures trip the
    // breaker so an upstream outage costs one timeout per cooldown, not per search.
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_THRESHOLD) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      consecutiveFailures = 0;
      console.error("intent-ai: breaker open for 60s (repeated failures)");
    }
    if ((err as Error).name !== "AbortError") console.error("intent-ai failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
