# Phase 1: walking skeleton

**Goal:** a diner scans a printed QR code on a real iPhone, orders from the menu, and the order shows up on the restaurant's live board, with the security model enforced and tested end to end. No payments yet.

## Briefs (run in order; one PR each)

| # | Brief | Outcome | Status |
|---|---|---|---|
| 01 | [Foundation, staff auth, onboarding](BRIEF-01-foundation.md) | Tooling, local Supabase with hardened schema, auth for Next 16, tokens, CI, owner sign-up to dashboard | Ready |
| 02 | Portal: menu, tables and QR, settings | Menu categories and items CRUD with inline 86 toggle; tables with printable QR sheet (label, QR, "Scan to order"); rotate or deactivate QR; edit-window setting | Outline |
| 03 | Diner flow | `/t/[token]`: anonymous sign-in protected by Cloudflare Turnstile (see note below), `join_table`, menu (sticky category tabs, item sheet, sold-out state), cart, `place_order`, order status page with realtime updates; invalid, rotated and closed-table states | Outline |
| 04 | Live order board and Phase 1 exit | Realtime board by status with new-order alert and age timers; accept, preparing, ready, served, cancel; close table session; full e2e (scan, order, board, status on phone); real-device test on iPhone Safari | Outline |

Briefs 02 to 04 get written in full after the previous PR merges, so each one reflects what actually shipped.

## Brief 03 note: Turnstile moved up from Phase 2

Decided 2026-09-28. Diners on one restaurant Wi-Fi share an IP, so Supabase's per-IP anonymous sign-in limit (default 30/hour) must be raised on the hosted project. Turnstile replaces that limit as the real abuse control, so it ships with the first diner sign-in, not later.

- Enable CAPTCHA (provider: Turnstile) in Supabase Auth, and in `supabase/config.toml` under `[auth.captcha]`. Pass the widget token to `signInAnonymously({ options: { captchaToken } })`.
- **Supabase CAPTCHA is one project-wide switch, and its docs describe it on sign-in, sign-up and password-reset forms, not only anonymous sign-in.** Expect the staff forms from Brief 01 to need the widget too. Verify against local Supabase early in Brief 03 (sign in as staff with CAPTCHA on and no token), then add the widget wherever a token is required.
- Local dev and CI use Cloudflare's documented test keys (always-pass). Real keys live only in Vercel and the Supabase dashboard.
- New env var: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public by design). The Turnstile secret goes only into Supabase Auth config, never into the app.
- Load the widget with Cloudflare's script. Ask before adding a wrapper library.

## Carried to later phases

- **Phase 2:** abuse controls still in Phase 2 are the 30-day anonymous-user purge and idle-session auto-close.
- **Phase 5 load test:** check Realtime against plan limits (Pro: 500 concurrent connections; Pro with spend cap off or Team: 10,000). Measure subscribers per restaurant and board latency under load. If Postgres Changes approaches its limits (Supabase recommends Broadcast above about 3,000 subscribers on the same changes), switch to Broadcast from the database with private channels. Because all realtime code lives in `src/lib/`, that switch should stay inside `src/lib/` plus one migration.

## Phase 1 exit criteria

- Printed QR on a real iPhone (Safari): menu is interactive in under 3 seconds on restaurant-grade Wi-Fi (target to validate, not a guarantee)
- The order appears on the staff board within 2 seconds (p95 over 20 trial orders), and each status change appears on the diner's phone
- `supabase test db` green (43+ tests); Playwright happy path green in CI
- Supabase security advisor: 0 errors. No secrets in git history (gitleaks).
- Ari has run one "fake dinner" with 2 or more phones at one table
