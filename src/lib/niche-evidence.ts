import { SPECIALIZATIONS, getSpec, specBySlug } from "@/lib/specializations";

/**
 * Deterministic (no-LLM) niche evidence per creator. Proof — delivered orders + active
 * gig tags/category — outweighs a bare declaration. A spec is "proven" when there's
 * evidence beyond the creator having declared it, which is what earns the ✓ marker and
 * lifts search ranking (declared-only is capped; see docs/search-ai-spec.md).
 */

export interface SpecEvidence {
  key: string;
  declared: boolean;
  fromGigs: number;
  fromOrders: number;
  /** Backed by real delivered work (completed orders in the spec's category). Earns the ✓. */
  proven: boolean;
  /** Has active gigs/tags in the spec but no delivered orders yet — a weaker signal than
   * proven and easily self-authored, so it ranks below proven and never earns the ✓. */
  supported: boolean;
}

export interface EvidenceInput {
  declared: string[];
  gigTags: string[];
  gigCategorySlugs: string[];
  orderCategorySlugs: string[];
}

export function computeSpecEvidence(input: EvidenceInput): Map<string, SpecEvidence> {
  const m = new Map<string, SpecEvidence>();
  const ensure = (k: string): SpecEvidence => {
    let e = m.get(k);
    if (!e) {
      e = { key: k, declared: false, fromGigs: 0, fromOrders: 0, proven: false, supported: false };
      m.set(k, e);
    }
    return e;
  };

  for (const k of input.declared) if (getSpec(k)) ensure(k).declared = true;

  // Category slugs map to skill specs where the slug lines up (e.g. "ai-video" → ai_video).
  for (const slug of input.gigCategorySlugs) {
    const s = specBySlug(slug);
    if (s) ensure(s.key).fromGigs += 1;
  }
  for (const slug of input.orderCategorySlugs) {
    const s = specBySlug(slug);
    if (s) ensure(s.key).fromOrders += 1;
  }

  // Tags match any spec (skill or niche) via its synonyms — this is where niches like
  // fashion get proven, since they aren't gig categories.
  const tagSet = new Set(input.gigTags.map((t) => t.toLowerCase()));
  for (const s of SPECIALIZATIONS) {
    if (s.synonyms.some((w) => tagSet.has(w.toLowerCase())) || tagSet.has(s.key)) {
      ensure(s.key).fromGigs += 1;
    }
  }

  // Proof requires DELIVERED work — completed orders in the spec's category. Active gigs
  // and gig tags are self-authored and editable after moderation (keyword-stuffing risk),
  // so they only make a spec "supported", never proven. This is the anti-gaming rule from
  // docs/search-ai-spec.md: a declared/tagged niche cannot top a genuinely proven one.
  for (const e of m.values()) {
    e.proven = e.fromOrders > 0;
    e.supported = !e.proven && e.fromGigs > 0;
  }
  return m;
}

/** Proven spec keys (evidence beyond declaration) for a set of raw signals. */
export function provenSpecKeys(input: EvidenceInput): Set<string> {
  const out = new Set<string>();
  for (const e of computeSpecEvidence(input).values()) if (e.proven) out.add(e.key);
  return out;
}
