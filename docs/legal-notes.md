# Legal punch list — for counsel review

The live drafts at `/legal/terms` and `/legal/privacy` describe what the system
actually does. Items below need professional confirmation before real-money launch.

1. **Operator identity.** Pages currently name no legal entity. Add the registered
   company (or self-employed founder) details once incorporation is settled.
2. **UZ personal-data localization.** Uzbekistan's Law "On Personal Data" requires
   citizens' personal data to be processed/stored on servers in Uzbekistan; our
   database is on an EU-hosted VPS. Counsel to advise: UZ hosting for the DB,
   consent-based carve-outs, or another compliant structure. (Tracked as the main
   compliance risk.)
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
