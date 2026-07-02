# UI Sprint 1 — Dark redesign + Instagram showcase (detailed brief)

Authoritative version of the sprint prompt handed to the UI team on 2026-07-02.
The paste-able prompt lives in the founder's message; this file is the reference copy.
Workflow contract: CONTRIBUTING.md. Request board: UI-REQUESTS.md.

Tasks (one branch each, `feature/dark-theme-<n>`):
1. Dark design-system foundation (globals.css tokens + header/footer)
2. Homepage dark restyle
3. Marketplace + browse + creators dark pass
4. Instagram auto-looping showcase on public profiles (NOT an icon — a living carousel)
5. Gig detail page upgrade (lightbox, sticky order panel, comparison, FAQ)
6. Loading skeletons + designed empty states
7. Buyer + seller dashboard visual refresh
8. Order status timeline stepper
9. Toast/dialog system (replace window.confirm + inline notices)
10. Mobile, a11y, contrast + reduced-motion final audit

Each task: verify locally (tsc + build + locale parity + 390px + contrast) BEFORE push;
push the branch; never touch main; platform files are off-limits (requests go to
UI-REQUESTS.md). Full per-task detail in the founder's prompt of 2026-07-02.
