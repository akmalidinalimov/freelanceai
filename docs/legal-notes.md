# Legal punch list — for counsel review

The live drafts at `/legal/terms` and `/legal/privacy` describe what the system
actually does. Items below need professional confirmation before real-money launch.

**See [legal-uz-requirements.md](./legal-uz-requirements.md)** for the cited UZ
legal-requirements brief (personal-data law incl. the 2026 localization amendment,
public-offer structure, e-commerce/consumer/language/operator-identity rules) — the
input for counsel and for producing the final uz/ru/en documents.

1. **Operator identity.** Pages currently name no legal entity + must publish the UZ
   entity's name, **STIR/INN**, legal address, contact. Add once incorporation settles.
2. **UZ personal-data localization (revised — 2026 amendment).** The old "all citizens'
   PII on UZ servers" rule was **liberalized** (Art. 27¹, signed 26 Mar 2026): ordinary
   PII may be stored abroad **if** info-security + international-standards + Uzbek-oversight
   conditions are met — so the EU-hosted DB is likely OK for ordinary PII, subject to
   counsel confirming the exact wording/effective date. **BUT biometric/genetic/telecom
   data must stay in Uzbekistan** → **synced Instagram media may contain faces (biometric)
   and must NOT sit on our EU/R2 servers** — decide before Instagram sync goes live: keep
   IG media out of foreign storage, or don't store it. Also: **register the personal-data
   database via pd.gov.uz BEFORE launch** (Art. 20, mandatory). Still the main risk cluster.
3. **Payments/escrow language.** §4 of the Terms describes held-payment mechanics.
   Must be aligned with the final PSP agent agreement so we never appear to be an
   unlicensed e-money operator (ledger ≠ wallet). Update when Payme/Click contracts
   are signed.
4. **Seller tax wording.** Confirm the self-employed (samozanyatiy) guidance and
   whether the platform has any withholding/reporting duties on payouts.
5. **Governing law / dispute clause.** Draft says Republic of Uzbekistan — confirm,
   and add arbitration/court venue language.
6. **Translations.** Legal pages are English-only v1. Produce uz + ru versions after
   the text is final (counsel-reviewed), not before.
7. **Contact mailbox.** `support@aicreator.academy` is referenced on both pages —
   create the mailbox (or change the address) before launch.
8. **Meta App Review** references both pages — keep URLs stable:
   `/uz/legal/terms`, `/uz/legal/privacy` (any locale prefix resolves).
