# Brief 01: Foundation, staff auth, onboarding

**Phase:** 1 (walking skeleton) · **Branch:** `phase-1/brief-01-foundation` · **Size:** about 2 to 4 focused sessions

## Objective

Stand up a production-shaped foundation that every later brief builds on: tooling, local Supabase with the hardened Phase 1 schema, Supabase auth wiring for Next.js 16, design tokens, CI, and one real vertical slice. That slice: a restaurant owner signs up, confirms their email, creates a restaurant, and lands on the portal dashboard.

When this merges, Brief 02 (menu, tables, QR, settings) starts on a codebase where the security model is already enforced and tested.

## Read first

1. `CLAUDE.md`: the invariants are non-negotiable
2. `docs/phase-1/SCAFFOLD-PLAN.md`: target tree, dependencies, config, build order
3. `supabase/migrations/20260928000000_phase1_core.sql`: the schema. It's already written and was tested against Postgres 16 with pgTAP (33 of 33 passing). Don't rewrite it. If you find a defect, fix it in a **new** migration and explain why in the PR.
4. `supabase/tests/database/phase1_security.test.sql`: the security contract

## Tasks and acceptance criteria

### 1. Tooling
- Add the scripts from the scaffold plan, plus prettier (with the Tailwind plugin), Vitest (jsdom), and Playwright (Chromium only).
- Add `!.env.example` to `.gitignore` and create `.env.example`.
- **Done when** `npm run lint && npm run typecheck && npm run test` pass on a clean clone.

### 2. Local Supabase
- `supabase init`, then apply the `config.toml` edits from the scaffold plan (anonymous sign-ins on, email confirmations on, anonymous rate limit raised). Verify key names against the generated file.
- Keep the existing migration and test in place. Write `supabase/seed.sql` with one demo restaurant (`demo-bistro`), 3 categories, about 12 items (one marked unavailable), and 4 tables. The seed may insert directly as the postgres role.
- Generate `src/lib/db/types.ts`.
- **Done when** `npm run db:reset && npm run db:test` shows 33 of 33 passing, and `supabase db lint` (or the dashboard advisors, if you run Studio locally) reports no security errors.

### 3. Supabase clients and session refresh (Next.js 16)
- `src/lib/supabase/{client,server,proxy}.ts` following Supabase's current Next.js SSR guide: publishable key, `getAll`/`setAll` cookies, and `getClaims()` in the proxy.
- `src/proxy.ts` exporting `proxy()` with the standard static-asset matcher. **No `middleware.ts`.**
- `src/lib/env.ts` (zod) and `src/lib/auth.ts` with:
  - `requireStaff()`: `getClaims()`; redirect to `/login` if there's no user or `is_anonymous` is true
  - `requireMembership(restaurantId?)`: loads the caller's first `restaurant_members` row; redirect to `/restaurant/onboarding` if there's none
- **Done when** Vitest unit tests cover `env.ts` (missing var throws; a secret-looking `NEXT_PUBLIC_` name is rejected) and `errors.ts` (every DB hint in CLAUDE.md maps to copy).

### 4. Design tokens and primitives
- `globals.css`: Tailwind v4 `@theme` tokens for color (brand, surface, surface-raised, border, text, text-muted, success, warning, danger), radius, and spacing. Include a light set and a dark set. Scope the portal to dark with a `data-theme="dark"` attribute on the portal layout. The diner side follows `prefers-color-scheme`.
- Brand color is undecided (the design board uses blue around `#3848D0`; the February portal used green `#2ECC8E`). Use a neutral placeholder token `--color-brand` and don't hardcode either.
- Build `Button` (primary/secondary/ghost, loading state), `Input` (with label and error text), `Card`, `Badge` (text plus color), `Skeleton`, and `EmptyState` in `src/components/ui`. Each one is keyboard and screen-reader correct, with 44px minimum touch targets.
- **Done when** a `/dev/ui` route (rendered only in development) shows every primitive in both themes, and each primitive has a render test.

### 5. Staff auth
- `/login` with sign-in and sign-up modes, both as Server Actions with zod-validated email and password (minimum 10 characters). Errors are generic ("Email or password is incorrect") so the form doesn't leak which accounts exist.
- Sign-up sends the confirmation email. Locally it's caught by Inbucket at `localhost:54324`. `/auth/confirm` exchanges the `token_hash`, then redirects to `/restaurant/onboarding`.
- `/auth/signout` is a POST route handler.
- **Never** disable email confirmations to work around rate limits, including in dev. Use Inbucket.
- **Done when** a new user can sign up, confirm, sign out and sign back in locally, and an anonymous session visiting `/restaurant/*` is redirected to `/login`.

### 6. Onboarding and portal shell
- `/restaurant/onboarding`: restaurant name plus slug. The slug is auto-derived and editable, with an inline format hint (`casa-grande`). It calls `create_restaurant` via a Server Action and maps a unique-violation to "That link is taken. Try another."
- `/restaurant/(portal)/layout.tsx`: dark shell, restaurant name, and nav (Orders, Menu, Tables, Settings, all "coming soon" except Dashboard). Uses `requireStaff()` and `requireMembership()`.
- Dashboard: a setup checklist (Add menu items · Add tables and print QR codes · Place a test order), with each item checked from real counts via RLS-scoped queries.
- **Done when** a signed-in owner without a restaurant is forced through onboarding, and one with a restaurant lands on the dashboard with a correct checklist.

### 7. CI and e2e
- `.github/workflows/ci.yml` per the scaffold plan: lint, typecheck, unit, `supabase start` plus `supabase test db`, build, gitleaks.
- `e2e/staff-onboarding.spec.ts`: sign up, fetch the confirmation link from the local Inbucket API, confirm, create restaurant, see dashboard.
- **Done when** CI is green on the PR.

## Out of scope (later briefs)

Menu CRUD, tables and QR generation, settings (Brief 02) · diner `/t/[token]` flow and cart (Brief 03) · realtime order board (Brief 04) · payments, groups, push, staff invites (later phases).

## Deliverable

One PR to `main` containing:
- a summary of what was built, mapped to the numbered tasks above
- `npm run check` output and the CI link
- screenshots: login, onboarding, dashboard (390px and 1024px), and `/dev/ui` in both themes
- decisions made, also appended to `docs/DECISIONS.md` (create it with the entries listed in the next section)
- anything you'd change in the schema, as a proposal only, not applied

## Seed entries for `docs/DECISIONS.md`

- 2026-09-28: Diners use Supabase anonymous auth, created at QR scan. No diner accounts in Phase 1.
- 2026-09-28: A QR code encodes a stable per-table token (`/t/<token>`), not a session id. Staff can rotate it.
- 2026-09-28: All order writes go through the `place_order` RPC. Prices are snapshotted from the DB.
- 2026-09-28: Phase 1 diners see only their own orders. Shared-table visibility is decided in Phase 4.
- 2026-09-28: Next.js 16 `proxy.ts` replaces `middleware.ts`. Tailwind v4 CSS-first config.
- 2026-09-28: Brand color TBD (blue from the design board vs green from the February portal). Tokenized until decided.

## Kickoff prompt (paste into Claude Code)

> Read `CLAUDE.md`, then `docs/phase-1/SCAFFOLD-PLAN.md`, then `docs/phase-1/BRIEF-01-foundation.md`. Create branch `phase-1/brief-01-foundation` from `main`. Plan the work as a checklist mapped to Brief 01's seven tasks and show me the plan before writing code. Then execute task by task: run `npm run check` after each task, commit with a conventional message, and stop to ask me before anything in "When to stop and ask Ari". Work against local Supabase only. When all seven tasks meet their "done when" criteria, open the PR described under Deliverable and stop.
