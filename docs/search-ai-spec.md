# AI Search & Creator Matching — Build Spec

Status: DRAFT (design) · Owner: eng · Depends on: existing FTS+trigram search, seller
levels/metrics, reviews, Instagram-portfolio phase (for caption/evidence signals).

Goal: a buyer describes a job in natural language ("kosmetika mahsulotim uchun 15s AI
reklama roligi", "fashion AI video", "restoran menyusi uchun fotosurat") and gets the
**top ~10 best-matched creators**, ranked by *evidence of relevant capability*, with a
one-line "why matched". Uzbek-first, uz/ru/en. Mobile-first latency.

## 0. Principles

1. **Rank on evidence, not claims.** What a creator *did* (delivered orders, reviewed
   work, posted IG content) outweighs what they *wrote about themselves*.
2. **No forced specialization at signup.** Niche is *derived* from IG + description +
   order history. Generalists get many moderate niches; specialists get concentrated ones.
3. **Hybrid retrieval.** Lexical (exact terms, the founder's "mentions fashion → ranks
   first" rule) + semantic (meaning, cross-language) — neither alone is enough.
4. **Progressive rollout.** Ship lexical+proof first (no new infra), add semantic, then
   Claude parse/rerank. Value early, risk low.
5. **Fail open.** If Claude or embeddings are unavailable, degrade to keyword search — the
   page never breaks.

---

## 1. The searchable creator document

One denormalized document per creator, rebuilt on the triggers below. It is the single
thing we index (both for FTS and for embeddings).

| Field | Source | Weight intent |
|---|---|---|
| `displayName`, `role`/headline | profile | high (identity) |
| `bio` / about | profile | medium (self-described — capped, see anti-gaming) |
| gig titles | gigs | high |
| gig descriptions | gigs | medium |
| skills / "AI tools used" | profile | medium |
| **IG post captions + hashtags** | Instagram sync (cached) | high (real posted work = evidence) |
| **delivered order categories/tags** | orders | **highest (proof)** |
| **review text** (buyer words) | reviews | high (third-party evidence) |
| derived niche tags + weights | §2 | ranking boost |

Refresh triggers: gig create/update/pause; profile edit; **Instagram sync**; order reaches
COMPLETED; new review. Rebuild is idempotent and cheap (single row upsert + one embedding
call). Debounce rapid edits (e.g. 30s) to avoid churn.

---

## 2. Specialization model — declared + derived (one shared taxonomy)

Two inputs, one controlled vocabulary. Both are optional; neither is a signup gate.

**A) Declared (optional multi-select).** At signup or anytime on the profile, a creator
picks any **skills** (what they make) and **niches** (industries they serve) they're good
at — choose all, a few, or none. They render on the profile as "Specializations".
Declared tags power: browse/filter chips, profile display, **candidate retrieval**, and a
**bounded cold-start signal** for creators with no order history yet. A generalist can
simply select many; a specialist selects a few — both are valid.

**B) Derived (automatic, evidence-weighted).** On each document rebuild, a classifier
(Claude Haiku, structured output) reads bio + gig text + **IG captions** + **delivered-
order categories** + **review text** and emits `nicheProfile = [{niche, weight 0..1,
evidence}]`. Evidence-backed niches get high weight; a niche appearing only in self-written
bio is capped low.

**How they combine (the anti-gaming rule):** declared tags make a creator *eligible and
filterable* and give a *small* cold-start nudge — but **only proof (derived, evidence-
backed weight) lifts ranking**. A niche you *declared but never delivered* stays capped and
cannot top a proven specialist. When a declared niche is corroborated by real delivered
work, show it with a ✓ **"verified specialization"** marker (reuses the KYC/verified trust
theme) — visible proof for buyers, and a natural disincentive to over-declare.

So "fashion AI video" ranks a fashion-*proven* creator first; a generalist who declared
(or actually does) fashion still appears — just below the specialist.

### Predefined taxonomy (v1 — expand from query logs)

**Skills / service types (what they create):** AI video (reklama · reels · explainer) ·
AI image / art · AI avatar / talking-head · Product photography · Voiceover & dubbing ·
Branding & logo · Motion graphics / animation · Image editing / retouch / upscale ·
3D / product render · Music & sound · Copywriting / scripts · Presentation / pitch decks.

**Niches / industries (who they serve):** Fashion & apparel · Food & beverage /
restaurants · Beauty & cosmetics · E-commerce & retail · Real estate · Gaming ·
Music & entertainment · Education & e-learning · Corporate / B2B · Health & fitness ·
Travel & hospitality · Automotive · Tech & startups · Events & weddings.

Each taxonomy entry has a stable `key` (e.g. `fashion`, `food_beverage`) + localized
uz/ru/en labels + synonyms (feeds query expansion in §4). Admin-managed (reuses the
existing category-management console) so the list grows without a deploy.

---

## 3. Indexing pipeline

### 3a. Lexical (Postgres FTS + trigram) — already partly in place
- `search_tsv tsvector` built with `to_tsvector('simple', unaccent(document))`. Use
  `simple` (not `english`/`russian`) because Uzbek has no stemmer; rely on unaccent +
  trigram for morphology/typos and Latin↔Cyrillic variance.
- `pg_trgm` GIN index on the raw document for fuzzy/substring and misspelling tolerance.
- Field weighting via `setweight()` (A=gig titles/order-categories, B=IG captions/reviews,
  C=bio/skills) so `ts_rank_cd` already respects the evidence hierarchy.

### 3b. Semantic (pgvector)
- Add `pgvector` extension (no new infrastructure — it lives in Postgres).
- `creator_embedding vector(1024)` (dim per chosen model), HNSW index, cosine distance.
- Embedding model: a **multilingual** model (candidates: Voyage `voyage-3` multilingual,
  Cohere `embed-multilingual-v3`, OpenAI `text-embedding-3-large`). **Open risk: validate
  Uzbek-Latin quality** on a real sample; if weak, pivot-translate the document to RU/EN
  via Claude before embedding. Model is pluggable behind an `Embedder` interface.
- Embeddings computed **on write** (document rebuild), cached; never per-search for creators.

---

## 4. Query pipeline (per search)

```
buyer free-text
   │
1. Normalize + cache key (lowercase, collapse ws, locale)
   │
2. Claude intent parse (Haiku, structured output)  ──► IntentJSON
   │      { service[], niche[], style[], budgetUzs?, deadlineDays?,
   │        language, mustHave[], expandedTerms[] (uz/ru/en synonyms) }
   │
3. Candidate retrieval (parallel):
   a. Lexical: FTS(expandedTerms) + trigram   → top 100  (+ranks)
   b. Semantic: embed(query) → pgvector kNN    → top 100  (+scores)
   │      apply hard filters from IntentJSON (budget, language, active, verified?)
   │
4. Fuse candidates with Reciprocal Rank Fusion (RRF)
   │
5. Business re-scoring (§5)  → sort → top K (=10)
   │
6. (optional) Claude rerank + "why matched" on top K only
   │
7. Return top 10 {creator, matchScore, reason, evidence}
```

- **Query expansion** (step 2) is where cross-language matching happens: "fashion" →
  {fashion, moda, kiyim, lookbook}. Feeds the lexical arm so even the FTS layer catches
  synonyms.
- **RRF** blends lexical and semantic *ranks* (not raw scores) robustly:
  `rrf = Σ 1/(k + rank_i)`, k≈60. Avoids scale-mismatch between `ts_rank` and cosine.
- Step 6 is optional and async-friendly: render results immediately from step 5, stream
  the "why matched" line in. Keeps p95 fast.

---

## 5. Ranking formula & weights (tunable)

```
final = 0.45 · relevance      // RRF(lexical, semantic), normalized 0..1
      + 0.25 · proof          // delivered orders + reviews + IG posts in the query niche
      + 0.20 · quality        // rating, seller level, on-time %, response time
      + 0.10 · availability   // online now, has free slots, fast responder
      − penalties             // §6
```

- `relevance` = fused lexical+semantic match against the document (this carries the
  founder's "mentioned fashion" rule via the lexical arm + niche weight from §2).
- `proof` = niche-scoped: count/recency of COMPLETED orders + reviews + IG posts whose
  derived niche ∈ query niche. **This is the anti-gaming backbone.**
- `quality` = normalized blend of existing seller metrics (already computed in the app).
- `availability` = small nudge so a great-but-offline creator still ranks, just slightly
  lower than an equally-good online one.
- Weights are config, not code — tuned by the §9 offline eval, later by learning-to-rank.

Worked example — query "fashion AI video", 3 AI-video creators:
- Malika (bio+IG+2 delivered fashion reels) → high relevance **and** high proof → #1.
- Dilnoza (AI video, no fashion evidence) → high relevance, low fashion-proof → #2.
- Generalist (video, one-off fashion mention in bio only) → relevance ok, proof≈0, bio
  capped → below both. Exactly the intended behavior.

---

## 6. Anti-gaming & quality guards

- **Self-text cap:** bio/self-declared text contributes to `relevance` but cannot alone
  lift a creator into the top tier — top ranks require corroborating `proof`.
- **Declared ≠ ranked:** selecting a niche from the taxonomy grants eligibility, a browse
  filter, and a bounded cold-start nudge only — it never substitutes for proof. Over-
  declaring ("I do everything") yields no top-rank advantage and no ✓ verified marker.
- **Keyword-stuffing detection:** term-repetition ratio + unrelated-term dumps → dampen the
  document's lexical weight; log for moderation.
- **Proof decay:** old evidence counts less (recency-weighted) so stale specialists don't
  camp the top forever.
- **New-creator exploration:** bounded exposure (small controlled boost / occasional slot)
  so newcomers can earn first orders without dominating — avoids cold-start lockout while
  preventing manipulation.
- **Negative signals:** low on-time %, high cancellation/dispute rate, moderation flags →
  penalty.
- **Trust gate:** only KYC-verified creators eligible for the top tier / featured surfaces
  (leverages existing verified badge). Reuses existing contact-info stripping/moderation.

---

## 7. Multilingual (uz/ru/en)

- Query expansion (Claude) emits uz/ru/en synonyms → lexical arm is language-agnostic.
- Multilingual embeddings cover semantic cross-language recall.
- `unaccent` + `simple` config + trigram handle Uzbek Latin/Cyrillic and diacritics.
- Documents store original text; no per-language columns needed for v1.

---

## 8. Data model (Prisma) + API

```prisma
model Specialization {          // predefined taxonomy (admin-managed)
  key      String  @id          // "fashion", "ai_video", ...
  kind     String              // "skill" | "niche"
  labelUz  String
  labelRu  String
  labelEn  String
  synonyms String[]            // feeds query expansion (§4)
  sellers  SellerProfile[]     @relation("SellerSpecializations")
}
// SellerProfile gains: declared M-N to Specialization ("SellerSpecializations")

model SellerSearchDoc {
  sellerId    String   @id
  document    String            // concatenated, weighted source text
  declared    String[]          // declared specialization keys (eligibility/filter/cold-start)
  nicheProfile Json             // derived: [{niche, weight, evidence}] — carries ranking weight
  updatedAt   DateTime @updatedAt
  seller      SellerProfile @relation(fields: [sellerId], references: [id])
}
// raw SQL migration: CREATE EXTENSION vector; ALTER TABLE add search_tsv tsvector,
// embedding vector(1024); GIN(search_tsv), GIN(document gin_trgm_ops), HNSW(embedding).
```

API: `POST /api/search/match`
```
req:  { query: string, locale: "uz"|"ru"|"en", filters?: {budgetMaxUzs?, verifiedOnly?} }
res:  { intent: IntentJSON,
        results: [{ sellerId, name, verified, matchScore, reason, evidence:{orders,posts,rating} }],
        degraded?: "keyword-only" }   // set when AI path unavailable
```
Rate-limited (reuse `enforceRateLimit`); same-origin; input validated (zod).

---

## 9. Rollout phases

- **S1 — Lexical + proof (no new infra).** Build the creator document (incl. IG captions +
  order categories), FTS+trigram over it, §5 ranking with `relevance=lexical`. Ships the
  founder's requirement immediately, with anti-gaming. *Gate: "fashion AI video" ranks a
  fashion-proven creator above generic video creators; keyword-stuffer does not top.*
- **S2 — Semantic.** Add pgvector + embeddings + RRF fusion. *Gate: cross-language and
  synonym queries ("clothing reels") retrieve the fashion creator.*
- **S3 — Claude intent + rerank.** Structured parse, query expansion, streamed "why
  matched" on top K. *Gate: intent chips correct on a 50-query eval set; p95 < 1.2s with
  rerank streamed.*
- **S4 — Learning-to-rank.** Tune weights from click/contact/hire feedback.

---

## 10. Performance, cost, evaluation

- **Latency budget (p95 < 1.2s):** Claude Haiku parse ~300–600ms (cached on repeat),
  query embed ~50–150ms, DB retrieval <100ms; rerank only top-K and streamed.
- **Cost:** creator embeddings on write (cheap, cached); per-search = 1 small embed + 1
  Haiku parse (cache identical queries); rerank optional/top-K only.
- **Eval:** hand-label a 50–100 query golden set (uz/ru/en, niche + generic) → track
  nDCG@10 / MRR each change. Add an admin "search debug" view showing per-candidate score
  breakdown (relevance/proof/quality) for tuning.
- **Metrics:** search→contact rate, search→order rate, zero-result rate, p95 latency.

---

## 11. Open decisions

1. Embedding model + **Uzbek quality validation** (pivot-translate fallback if weak).
2. Niche taxonomy list (start ~12, expand from real query logs).
3. RESOLVED: declared multi-select from the §2 taxonomy (optional) + auto-derived,
   evidence-weighted niches. Declared = eligibility/filter/cold-start; derived proof =
   ranking. Show ✓ "verified specialization" where declared ∩ proven. Also surface derived
   niches the creator didn't declare as soft suggestions they can adopt or hide.
4. Claude model tier for parse (Haiku default) and whether rerank is on by default or A/B.
