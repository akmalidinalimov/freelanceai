# Founder execution checklist (2026-07-02)

Ordered by what each unlocks. After each handoff the platform team executes,
verifies, and reports green before the next item. Full step detail was given in
chat; this is the tracking copy.

| # | Item | Status | Hands to platform team | Verified by |
|---|------|--------|------------------------|-------------|
| 1 | Meta Business + App (Instagram Business Login, redirect URI set) + Pixel + IG tester | ☐ | App ID, App Secret, Pixel ID | Live IG connect on founder's profile; Pixel wired consent-gated |
| 2 | Anthropic API key (console.anthropic.com) | ☐ | sk-ant-… | S3 intent search live, better "understood/why-matched" |
| 3 | Voyage AI key (voyageai.com) | ☐ | pa-… | S2 semantic search live, fuzzy-query A/B check |
| 4 | Buy gigora.ai (Cloudflare Registrar) | ☐ | "bought" | Rebrand runbook executed, suite green on gigora.ai |
| 5 | Microsoft Clarity project | ☐ | Project ID | Recordings/heatmaps flowing (consent-gated) |
| 6 | support@aicreator.academy (CF Email Routing → Gmail) | ☐ | "done" | Test email received |
| 7 | Rotate exposed tokens: @kontent_pro_bot (BotFather /revoke) + OpenAI key | ☐ | new values | SMM bot redeployed + answering |
| 8 | Counsel email (docs/legal-notes.md + chat-review/Clarity disclosure question) | ☐ | counsel reply | Legal pages updated if needed |
| 9 | Cloudflare edge-cache rule (LAST — after redesign settles) | ☐ | rule created | Load-test before/after numbers |

Notes:
- #1 first: Meta App Review is the 2–4 week long pole; the same errand unlocks
  Instagram AND ads retargeting.
- #2+#3 together: one build run delivers both search upgrades (tasks #98/#99).
- Platform Phase 1 (email login, admin conversation viewer, red-flag engine,
  pair + category stats) runs independently on the founder's "go phase 1".
