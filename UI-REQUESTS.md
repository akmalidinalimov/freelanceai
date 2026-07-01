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

## → For the platform team

(nothing pending)
