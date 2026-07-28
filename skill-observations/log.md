# Skill Observation Log

**Status key:** OPEN | ACTIONED | DECLINED

---

### Observation 1: Security review of signed-token auth must test the CURRENT wire format, not a simplified one

**Date:** 2026-07-03
**Session context:** Adversarial security review of a Telegram Mini App passwordless auth path (verifyMiniAppInitData).
**Skill:** qa-verifier / security-review
**Type:** open-source
**Phase/Area:** Verification of signature-verification code

**Issue:** The highest-severity defect was NOT a forgery hole but a spec-drift availability bug: the code's data-check-string excluded only `hash`, while the current Telegram wire format also requires excluding `signature`. Unit tests passed because they hand-built payloads WITHOUT the newer `signature` field, so the tests validated a stale/simplified format that no real client sends. An empirical reproduction with a realistic payload was required to confirm.

**Suggested improvement:** When reviewing any signed-token/HMAC verifier, fetch the vendor's CURRENT field list and reproduce with a payload that includes every field a real client sends today (not the fields the local tests happen to use). Passing unit tests are not evidence the format is current.

**Principle:** Signature-verification bugs hide equally in "rejects valid input" (availability) and "accepts invalid input" (forgery). Verify against the live spec's full field set, and treat the project's own test fixtures as suspect — they encode the author's assumptions, which are exactly what a spec-drift bug violates.
