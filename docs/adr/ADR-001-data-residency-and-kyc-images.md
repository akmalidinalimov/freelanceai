# ADR-001 — Data residency & KYC / face image storage

**Status:** OPEN — **blocking before KYC images are collected at volume**
**Date:** 2026-07-11
**Deciders:** founder + legal counsel (counsel not yet engaged)

## Context

Gigora serves the Uzbekistan market. A one-way-door decision is *where* user data — especially
KYC identity documents and portfolio/profile photos containing **faces** — physically lives.
Today the app + Postgres run on a single Hostinger VPS and blobs live in Cloudflare R2; neither
region has been chosen against the legal constraint, and no data has been migrated, so this is
still reversible **only until real KYC data lands**.

Per `docs/legal-uz-requirements.md`: Uzbek law treats face images as potentially **biometric
data** that "must not sit on our EU/foreign servers." Ordinary PII *may* be permissible on
EU/India hosting under three conditions, but biometric data is more restrictive. This is a new
law with real exposure — getting it wrong is a legal/operational blocker, not a preference.

## Options

1. **All data in-country (Uzbekistan hosting).** Safest legally; higher cost, thinner managed
   tooling, weaker CDN/edge story.
2. **Split: biometric/KYC images in-country; ordinary PII + app on EU/India.** Matches the law's
   own distinction; adds a storage-routing seam (already partly present — the private-bucket
   abstraction in `src/lib/media.ts` can target a different bucket/region per prefix).
3. **Everything on EU/India (status quo trajectory).** Simplest ops; **likely non-compliant for
   face/KYC images** — rejected pending counsel.

## Decision

**Deferred, with a hard gate:** do not collect KYC/face images at volume until counsel confirms
an option. Leading candidate is **Option 2** because the codebase already has the seam
(`privateBucketFor()` routes by prefix; `deliveries`/`requirements`/`messages` → a private
bucket that can be pinned to an in-country region without touching consumers). Encode the gate
as an operational check: **KYC upload stays behind a flag until residency is resolved.**

## Consequences

- The private-bucket abstraction must support a **per-prefix region/endpoint**, not just a
  per-prefix bucket, if Option 2 is chosen (small extension to `media.ts`).
- A residency choice interacts with backups (ADR-TBD) — backup targets inherit the constraint.
- Until resolved, KYC verification cannot rely on stored ID images; phone-based KYC (current
  path) is unaffected.
- Revisit if the market expands beyond Uzbekistan (each market adds its own residency law).
