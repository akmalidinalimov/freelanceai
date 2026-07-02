# UI ⇄ Platform request board

Cross-team async channel (see CONTRIBUTING.md). UI team: write requests for backend
changes here instead of editing platform files. Platform team: write UI tasks that
need frontend work here instead of editing components.

## → For the UI team

### 1. Account data-export + deletion controls (Settings page)
Backend is live; needs UI in `src/components/settings-form.tsx` (or a new section on
the settings page):
- **"Download my data"** button → `GET /api/me/export` (auth'd) → offer the JSON as a
  file download (`freelanceai-data.json`).
- **"Delete account"** (danger zone) → confirm dialog requiring the user to type
  `DELETE` → `POST /api/me/delete` body `{"confirm":"DELETE"}`.
  - `409 CONFLICT` responses carry a message: active orders must finish first, or a
    seller balance must be withdrawn first — surface it.
  - On success `{ok:true}` the session is already destroyed server-side → redirect to `/`.
- i18n: add keys in all three locales under a new `Account` namespace.

### 2. Instagram connect + synced portfolio (profile editor & public profile)
Backend is live (env-gated until Meta setup; see docs/instagram-go-live.md):
- **Profile editor** (`src/app/[locale]/dashboard/seller/profile/page.tsx` area):
  - "Connect Instagram" button → plain link to `GET /api/instagram/connect`
    (redirects to Instagram; comes back to the editor with `?ig=connected|error|unavailable`
    — show a toast/badge per marker).
  - When connected (SellerProfile.instagramUserId set): show "@handle · connected",
    last-synced time (instagramSyncedAt), and a "Disconnect" button →
    `POST /api/instagram/disconnect` (removes synced items too — warn in the dialog).
- **Public profile**: portfolio items now carry `source` ("upload"|"instagram") and
  `permalink`. Per the approved design-b2-profile.html mockup: horizontal snap
  carousel; ▶ overlay for `mediaType === "video"` (image is the poster; link out
  to `permalink`); "↗ Instagram'da koʻrish" link on synced items; keep manual
  uploads first (they have position < 100).
- i18n keys under an `Instagram` namespace, all three locales.

### 3. Legal pages — footer links + restyle
`/[locale]/legal/terms` and `/[locale]/legal/privacy` exist (plain, functional,
English v1 — content is counsel-pending, do not rewrite the text). Please:
- add "Terms" + "Privacy" links to `src/components/site-footer.tsx`
- restyle the pages to the new design system when the redesign lands (typography
  only; keep URLs and content intact — Meta App Review references these URLs)

### 4. "Deleted user" fallback where a counterparty anonymized their account
After account deletion we keep orders/reviews/messages as anonymous records (names
nulled). Please show a localized **"Deleted user"** instead of a blank/`—` name in:
- `src/app/[locale]/orders/[id]/page.tsx` (counterparty name ~line 51)
- `src/app/[locale]/gigs/[slug]/page.tsx` (review author name ~line 263)
- `src/app/[locale]/messages/page.tsx` (conversation peer ~line 31)
Add a shared key (e.g. `Common.deletedUser`) in all three locales. No crash today
(avatar initial handles `""`), purely cosmetic — a blank name next to a real review
reads as a bug.

## → For the platform team

(nothing pending)

## 📝 Merge notes from platform team

**feature/ui-icons-gig-cards — merged to main + deployed (2026-07-02).** Great first
push: clean branch point, lucide dep already present, rating chip properly guards the
empty state. One change: the seed hunk that fabricated ratingAvg/ratingCount (4.6–5.0,
7–126) was reverted — platform honesty rule: ratings must trace to real Review rows
(same reason the ticker now uses real events). Cards show no rating chip until real
reviews exist, which your `ratingCount > 0` guard already handles. If pre-launch cards
feel empty, propose visible-demo alternatives (e.g. a "Demo" badge on seed profiles).
Going forward: for changes to `src/server/services/**` or `prisma/**` (platform
territory), drop a request here instead — UI-side widening like the gig-card `select`
was fine to take as-is this time.
