# Uzbekistan legal requirements — Terms (public offer) & Privacy Policy

**Purpose:** a cited brief to hand a **licensed Uzbek lawyer**. This is information-gathering,
**not legal advice**; final documents must be drafted/validated by counsel. Compiled 2026-07
(researcher pass). Several UZ laws were amended repeatedly (2021, 2022, 2024, 2026) — counsel
must validate every article number against the current text on [lex.uz](https://lex.uz).

Companion: [legal-notes.md](./legal-notes.md) (the running punch list). Engage counsel —
memory notes Azizov & Partners / Esplora Legal.

---

## TL;DR — top 3 risks (confirm first)

1. **Data localization under the just-amended regime + Instagram facial images.** The 2026
   amendment *liberalized* localization (ordinary PII may go abroad under conditions), but
   **biometric/genetic/telecom data must stay in Uzbekistan**. Synced Instagram media may
   contain **faces → potentially biometric → must not sit on our EU/foreign servers**. New law,
   sources conflict on effective date — highest urgency.
2. **Mandatory personal-data database registration before launch** (Art. 20, via pd.gov.uz).
   Processing before registration is a violation.
3. **UZ-resident legal entity + Uzbek-language public offer.** E-commerce operator status is
   restricted to UZ-resident legal entities, and e-commerce contract terms must be in Uzbek —
   structural prerequisites, not cosmetic.

---

## 1. Personal Data Law (ЗРУ-547, 02.07.2019, amended incl. 2026)

- **Localization — 2026 change:** the amendment (President signed 26 Mar 2026) revises **Art. 27¹**
  and **removes the blanket "all servers in Uzbekistan" rule**. Ordinary PII of Uzbek citizens
  **may be stored/processed abroad if three conditions are met simultaneously**: (1) info-security
  requirements ensured, (2) compliance with international data-protection standards, (3) oversight
  by authorized Uzbek bodies. Motivation: enable Apple/Google Pay, PayPal.
  Sources: [Kun.uz 2026-03-27](https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems),
  [SETTLE Advisory](https://settleadvisory.com/news-en/localization-of-personal-data-in-uzbekistan-transition-to-a-more-flexible-regulatory-model/),
  [Daryo 2026-03-29](https://daryo.uz/en/2026/03/29/uzbekistan-amends-personal-data-law-for-domestic-storage-and-regulated-foreign-processing/).
  **Effective date unconfirmed** (sources give 22 Jan vs 27 Mar 2026 — likely signing vs entry-into-force).
- **Must stay in Uzbekistan (cannot go abroad):** **biometric** (fingerprints, facial/Face-ID
  images, iris, voice), **genetic**, and **telecom-subscriber** data.
- **Old rule (pre-2026, now partly obsolete):** strict "all Uzbek citizens' PII on UZ servers,"
  enforced by an infringement register + **website blocking** (TikTok, 2021). Older firm memos
  describe this — treat as superseded, confirm with counsel.
- **Database registration (Art. 20):** **mandatory** in the State Register **before processing**,
  filed electronically via **pd.gov.uz**; decision in 15 days; changes notified within 10 working
  days. Authority is a moving target (State Personalization Centre → "Personalization Agency" →
  possibly under Ministry of Justice — confirm). Name-only datasets are exempt; Gigora collects
  far more, so **not exempt**. [Azizov & Partners](https://azizovpartners.uz/en/memos/registration-of-databases-containing-personal-information/),
  [DLA Piper UZ](https://www.dlapiperdataprotection.com/index.html?t=law&c=UZ).
- **Consent:** must contain defined elements (operator ID, subject, purposes, categories, validity,
  disclosure permissions); **written consent** for biometric/genetic/health; new consent if use
  exceeds declared purpose; withdrawable.
- **Cross-border transfer:** allowed to "adequate protection" countries, but **no official adequacy
  list** — operator bears the assessment; otherwise needs explicit subject consent. Confirm whether
  **Telegram/Google sign-in** flows count as cross-border transfers needing explicit consent.
- **Operator duties:** security measures, appoint a responsible person/DPO, document data flows,
  bind processors contractually, **publish a privacy policy**.
- **Penalties:** admin fines (~USD 200 individuals / ~USD 1,450 officials), criminal liability for
  unlawful collection/dissemination, and **website blocking** for localization breaches.

**Gigora must / confirm:** ordinary PII likely OK on EU/India hosting under the 3 conditions —
confirm exact amended-Art-27¹ wording; **keep any biometric (incl. Instagram facial images),
genetic, telecom data out of foreign servers, or don't store it**; **register the DB via pd.gov.uz
before launch**; build a compliant consent flow + privacy policy; appoint a data-protection person.

## 2. Public offer (ommaviy oferta) — Terms structure

- A marketplace's Terms are conventionally a **public-offer agreement** under the Civil Code
  (**Art. 369** offer/public offer, **Art. 370** acceptance, **Art. 426** display to an indefinite
  circle = public offer). In practice **registration / clicking "accept" = full unconditional
  acceptance**. [WIPO Lex – Civil Code](https://www.wipo.int/wipolex/en/legislation/details/18097).
  Live UZ examples: [Uklon](https://uz.uklon.eu/en/legal/public-offer-for-partner/), [getexperts.uz](https://getexperts.uz/en/legal-doc/public-offer-hereinafter-referred-to-as-the-agreement/).

**Gigora must / confirm:** structure Terms as a **public offer** with an explicit "account creation
/ first use = acceptance" clause; enumerate essential terms incl. the platform commission.

## 3. E-commerce Law (ЗРУ-792, in force 31.12.2022) + 2024/2025 rules

- **Operator must be a UZ-resident legal entity.** New implementing rules (CoM resolution 28 Dec
  2024, effective 1 Jul 2025): comply with e-commerce/data/copyright/consumer/advertising law;
  **notify authorities within 10 working days** of name/location changes; **separate bank accounts**;
  **integrate with Tax & Customs Committees** (fiscalization); provide info to authorities on request.
  [Times of Central Asia](https://timesca.com/uzbekistan-introduces-new-rules-for-e-commerce-platforms/),
  [Grata](https://gratanet.com/news/uzbekistan-adopts-the-law-on-electronic-commerce-in-a-new-edition).

**Gigora must / confirm:** operate via a **UZ-resident entity**; plan **tax-system integration** +
separate-account payout handling; confirm the competent regulator (MinIT / NAPP).

## 4. Consumer protection (Law 221-I, 26.04.1996, amended)

- Mandatory disclosure of **seller full name + legal address** (and QR of licenses where relevant),
  clear product/service info before purchase. Enforcer: [raqobat.gov.uz](https://raqobat.gov.uz/en/).
  A new Consumer Protection Code is in development. Refund/withdrawal rules for **digital creative
  services** are not clearly spelled out — needs counsel. [Law 221-I, lex.uz](https://lex.uz/docs/4525010).

**Gigora must / confirm:** publish seller + platform identity and clear service info pre-purchase;
define refund/dispute rules; map digital-service refund rights + platform-vs-seller liability.

## 5. Language

- **E-commerce contract terms must be in the state language (Uzbek)**, "clear and understandable."
  Uzbek's state script is **Latin** (statutory transition) but **Cyrillic is still widely used**;
  **Russian is expected in practice** but doesn't substitute for the required Uzbek text.
  [Legal500 – Advertising & Media Law UZ](https://www.legal500.com/developments/thought-leadership/advertising-and-media-law-in-uzbekistan-navigating-ip-compliance-and-consumer-protection/).

**Gigora must / confirm:** produce Terms + consumer text in **Uzbek as the governing version**;
Russian + English as convenience translations; confirm Latin vs Cyrillic and which version prevails.

## 6. Operator identity disclosure

- Publish the operating entity's **full legal name, legal address, STIR/INN**, contact details
  (changes notified within 10 working days), and license QR where applicable.

**Gigora must / confirm:** put the UZ entity's name/STIR/address/contact in the footer + Terms.

## 7. E-money / payment-agent constraint (confirmation only)

- A **non-bank cannot issue e-money or hold client cash as its own wallet.** Non-bank payment
  organizations need a **CBU licence** and must partner with a bank. Law "On Payments and Payment
  Systems," in force 03.02.2023. [Grata](https://gratanet.com/publications/electronic-money-in-uzbekistan-1),
  [Esplora Legal](https://esploralegal.com/regulation-of-payment-organizations-in-the-republic-of-uzbekistan/).

**Gigora must / confirm:** keep the double-entry ledger an **accounting record, not spendable
e-money**; move money via licensed PSPs + card payout; describe accurately in Terms; confirm the
payment-agent structure with fintech counsel.

---

## Questions for counsel

1. Exact **in-force date + text of amended Art. 27¹** — do the 3 conditions permit hosting Gigora's
   ordinary PII on EU/India servers?
2. Are **Instagram media / facial images = biometric data** that must stay in Uzbekistan?
3. Which **authority + portal** currently administer PD-database registration; does one registration
   cover the whole platform?
4. Do **Telegram/Google sign-in** flows count as cross-border transfers needing explicit consent?
5. Must Gigora operate via a **UZ-resident legal entity**; what registration/notification + tax/customs
   integration attach?
6. **Language/script** required for the public offer; which version legally prevails?
7. **Consumer refund/withdrawal** rights for digital creative services; platform-vs-seller liability?
8. Does our **ledger + PSP payout** model stay clear of e-money; what payment-agent agreement is needed?
9. Exact **operator identity** details to publish, and where?

## Confidence

High: existence/structure of the personal-data, e-commerce, consumer, public-offer, and e-money
regimes; that a 2026 localization liberalization happened with biometric/genetic/telecom carve-outs.
Lower (verify vs live lex.uz + counsel): exact 2026 effective date; current data-authority name;
precise article numbers for disclosure duties; Latin-vs-Cyrillic mandate; digital-service refund specifics.
