# Phase 1: walking skeleton

**Goal:** a diner scans a printed QR code on a real iPhone, orders from the menu, and the order shows up on the restaurant's live board, with the security model enforced and tested end to end. No payments yet.

## Briefs (run in order; one PR each)

| # | Brief | Outcome | Status |
|---|---|---|---|
| 01 | [Foundation, staff auth, onboarding](BRIEF-01-foundation.md) | Tooling, local Supabase with hardened schema, auth for Next 16, tokens, CI, owner sign-up to dashboard | Ready |
| 02 | Portal: menu, tables and QR, settings | Menu categories and items CRUD with inline 86 toggle; tables with printable QR sheet (label, QR, "Scan to order"); rotate or deactivate QR; edit-window setting | Outline |
| 03 | Diner flow | `/t/[token]`: anonymous sign-in, `join_table`, menu (sticky category tabs, item sheet, sold-out state), cart, `place_order`, order status page with realtime updates; invalid, rotated and closed-table states | Outline |
| 04 | Live order board and Phase 1 exit | Realtime board by status with new-order alert and age timers; accept, preparing, ready, served, cancel; close table session; full e2e (scan, order, board, status on phone); real-device test on iPhone Safari | Outline |

Briefs 02 to 04 get written in full after the previous PR merges, so each one reflects what actually shipped.

## Phase 1 exit criteria

- Printed QR on a real iPhone (Safari): menu is interactive in under 3 seconds on restaurant-grade Wi-Fi (target to validate, not a guarantee)
- The order appears on the staff board within 2 seconds (p95 over 20 trial orders), and each status change appears on the diner's phone
- `supabase test db` green (43+ tests); Playwright happy path green in CI
- Supabase security advisor: 0 errors. No secrets in git history (gitleaks).
- Ari has run one "fake dinner" with 2 or more phones at one table
