# CLAUDE.md: Salu

Build contract and live status for Salu. Sections follow the documentation standard in the user-level `~/.claude/CLAUDE.md`, in its order. Spec and intent live in the Salu PRD (Notion); this file wins on state, the PRD wins on intent, and a conflict between them is logged below, never resolved silently. Repo state (`git status`, `git log`, a test run) beats everything written here.

## 1. Decision log

Dated, append-only, newest at the bottom. Format: `**YYYY-MM-DD — ruling.** Why. Consequence. Considered and rejected.` An entry that supersedes an earlier one says so by date. A ruling that exists only in chat, a PR, or memory does not exist until it is here.

- **2026-09-28 — Diners use Supabase anonymous auth, created at QR scan.** No diner accounts in Phase 1. Consequence: rule 2. Rejected: email or phone accounts for diners.
- **2026-09-28 — A QR code encodes a stable per-table token (`/t/<token>`), not a session id.** Staff can rotate it. Consequence: rule 3 and the `join_table(qr_token)` RPC. Rejected: session ids in the QR.
- **2026-09-28 — All order writes go through the `place_order` RPC.** Prices are snapshotted from the DB. Consequence: rule 4. Rejected: client-side totals.
- **2026-09-28 — Phase 1 diners see only their own orders.** Shared-table visibility is decided in Phase 4 (backlog).
- **2026-09-28 — Next.js 16 `proxy.ts` replaces `middleware.ts`. Tailwind v4 CSS-first config.** Consequence: rules A2 and the Stack section. Rejected: v3 `@tailwind` directives (broke the February prototype's dark theme).
- **2026-09-28 — Brand color TBD.** Blue from the design board vs green from the February portal. Tokenized as `--color-brand` until decided. Open decision 1.
- **2026-09-28 — Stack reviewed against Nautilly (Expo) and Bonerot (Unity + Firebase). Staying on Next.js + Supabase + Vercel.** Diners need no-download web, and the data is relational with DB-enforced security.
- **2026-09-28 — All Supabase access goes through `src/lib/` as the portability seam.** Enforced by the pre-commit hook. Consequence: rule A8.
- **2026-09-28 — Cloudflare Turnstile moves from Phase 2 to Brief 03.** Diners on one Wi-Fi share an IP, so the per-IP anonymous limit is not a real abuse control. Supabase CAPTCHA is project-wide, so staff forms likely need it too (ruled 2026-09-29, see below).
- **2026-09-28 — Claude Code commits per task and opens one PR per brief. Ari reviews and merges.** Consequence: Roles and rule G6.
- **2026-09-28 — Local container runtime is colima** (Docker-compatible, free for commercial use) instead of Docker Desktop.
- **2026-09-28 — Dependencies at latest compatible versions; two held back.** TypeScript 6.0 (typescript-eslint, used by eslint-config-next, supports TS < 6.1) and ESLint 9 (eslint-config-next's react, import and jsx-a11y plugins crash on ESLint 10). Revisit when eslint-config-next supports them (backlog).
- **2026-09-28 — Node 22 pinned** (`.nvmrc`, `engines`). Vercel should use Node 22 to match.
- **2026-09-28 — pgTAP fixtures scope lookups to the test's own restaurant.** `supabase test db` runs after `seed.sql` and menus are publicly readable. No assertion changed.
- **2026-09-28 — Staff email confirmation uses the token_hash template** in `supabase/templates/confirmation.html`. The hosted project needs the same template in Dashboard > Auth > Email Templates (done by Ari 2026-09-28).
- **2026-09-28 — Local mail is Mailpit** (the Supabase CLI replaced Inbucket). Same port, 54324; e2e reads its API.
- **2026-09-28 — Staff passwords are at least 10 characters** in both zod and Supabase Auth (`minimum_password_length`).
- **2026-09-28 — Test-only dependencies beyond the scaffold table:** `vite` (peer of vitest 5 and @vitejs/plugin-react 6), `@testing-library/jest-dom` (DOM matchers) and `@testing-library/user-event` (realistic clicks in render tests). No runtime dependencies were added.
- **2026-09-28 — `next dev` writes a managed "Next.js agent rules" block into this file.** Kept: it points at the version-matched docs in `node_modules/next/dist/docs` and is re-added on every `next dev` anyway. It stays at the end of the file.
- **2026-09-28 — Form Server Actions return `FormResult`** (`src/lib/errors.ts`): the `{ ok, data } | { ok: false, error }` shape plus `fieldErrors` and echoed `values` on failure, and `null` as the idle state for `useActionState`.
- **2026-09-28 — The CI Supabase CLI is pinned to the `supabase` devDependency version** so the generated-types drift check is stable.
- **2026-09-29 — This file reconciled to the user-level documentation standard.** Why: the standard requires one format for every app repo, and this file had none of its sections (decision log, open decisions, handoff, coverage). Consequence: the decision log moved here from `docs/DECISIONS.md`, which is now a pointer; every existing rule kept its text and gained a citable number; PR "Needs Ari" items became numbered open decisions. Rejected: keeping two logs (a second source of truth).
- **2026-09-29 — `NEXT_PUBLIC_SITE_URL` is browser-safe and listed in invariant 6.** Resolves open decision 2. Why: QR codes and auth redirects need the public base URL, and it is not a secret. Consequence: invariant 6 lists three vars; no code change. Rejected: deriving it from request headers (fragile behind proxies).
- **2026-09-29 — Restaurant timezone is set on the Brief 02 Settings page, not at onboarding.** Resolves open decision 3. Why: owners can already update `restaurants.timezone`; onboarding stays name + slug. Consequence: default stays `America/New_York` until Settings ships. Rejected: a picker at onboarding (scope creep on Brief 01, Settings covers it).
- **2026-09-29 — Add the `server-only` package in Brief 02.** Resolves open decision 4. Why: server modules fail the build if a client component imports them, at zero runtime cost. Consequence: approved dependency under rule S2; Brief 02 adds it and marks `src/lib/supabase/server.ts`, `src/lib/auth.ts` and `src/lib/env.ts`. Rejected: relying on review alone.
- **2026-09-29 — Turnstile on staff forms: verify locally in Brief 03, then add the widget wherever Supabase requires a token.** Resolves open decision 7. Why: Supabase CAPTCHA is one project-wide switch, so the test is cheap and decisive. Consequence: Brief 03 turns CAPTCHA on locally, signs in as staff with no token, and adds the widget where that fails. Rejected: shipping the widget on `/login` in Brief 02 before the diner flow exists.
- **2026-09-29 — Correction to the `server-only` entry above (same date): `src/lib/env.ts` is not marked.** Why: `src/lib/supabase/client.ts` (the browser client) imports it, so marking it would break every client component that uses Supabase. Consequence: Brief 02 marks `src/lib/supabase/server.ts`, `src/lib/auth.ts`, `src/lib/staff-auth.ts`, `src/lib/restaurants.ts` and new server lib modules; `src/lib/supabase/proxy.ts` stays unmarked. Rejected: splitting `env.ts` into server and browser halves (no secret lives in it; all three vars are browser-safe under invariant 6).
- **2026-09-29 — Brief 02 builder calls, pending PM review.** Written into `docs/phase-1/BRIEF-02-portal.md` without a separate ruling; Ari's `go` accepted the brief as drafted. (a) Tables have no delete control, only deactivate (rule 5). (b) A category can be deleted only when it has no items, because `on delete set null` would orphan them off the diner menu. (c) Items can be deleted with an in-page confirmation, because `menu_items` has no hide flag and order history keeps its snapshot. (d) Dietary tags are a fixed six-value vocabulary. (e) Floor staff see no QR tokens or print sheet, although RLS lets members read tokens (screen exposure, not access). (f) Reordering uses up/down buttons, not drag (keyboard and screen-reader users). Rejected: asking before each; all are reversible UI choices inside the existing grants.
- **2026-09-29 — Brief 02 build calls beyond the brief, pending PM review.** Found by the pre-PR spec audit; kept deliberately. (g) The item form's category select lists hidden categories as "(hidden)"; the brief said active only, but then an item in a hidden category would lose its category on save. (h) The 86 switch keeps one accessible name ("Available Lobster Roll") and shows state through `aria-checked` plus the row's "Sold out" badge; the brief asked for a label that flips, which breaks the switch pattern and WCAG 2.5.3 label-in-name. (i) Rotating a QR confirms with an inline status line, not a toast: no Toast primitive exists yet (PRD 5.6 lists one; build it with the board in Brief 04). (j) Settings copy: the link reads "set at sign-up, can't be changed yet", not the brief's "Changing your link would break printed codes", which is false (the QR carries the token); the add-on cutoff hint says "a later update" rather than naming Phase 2 to restaurant staff. (k) Hidden categories get a dashed card and a "Hidden" badge; active ones carry no badge. (l) The time zone check accepts anything `Intl.DateTimeFormat` accepts, including aliases such as `UTC`, so a stored alias stays valid. (m) Tasks 2 and 3, and 4 and 5, shipped as one commit each because they share pages. Rejected: reworking to the letter of the brief where the brief was wrong.
- **2026-09-29 — Writes that RLS may filter are checked by row count.** Why: Postgres RLS makes a disallowed UPDATE or DELETE affect 0 rows without raising, so a Server Action would report success to floor staff. Consequence: `src/lib/mutations.ts` (`oneRowChanged`) treats 0 rows as `not_allowed`; pgTAP "cannot change" tests count affected rows next to a positive-control read. Rejected: `throws_ok` on updates (it never fires).
- **2026-09-29 — Floor-staff portal views are covered by role-prop render tests and pgTAP, not e2e.** Why: Phase 1 has no invite flow and no secret key, so e2e cannot sign in as `role = staff`. Consequence: gated item in section 9. Rejected: test-only membership seeding (new infrastructure for a Phase 2 flow).
- **2026-09-29 — `seed.sql` dietary tags use the vocabulary values (`vegetarian`, `gluten-free`), not `V` and `GF`.** Incident: the spec audit found that saving any seeded item in the new form would silently drop its tags. Consequence: seed fixed; a Vitest drift guard reads `seed.sql` and fails on any tag outside the vocabulary (falsified by restoring one `V`). If the hosted project was seeded with the old values, it needs the same change.
- **2026-09-29 — `toAppError` takes the meaning of a unique violation per form.** Why: a duplicate table label read "That link is taken." Consequence: codes `label_taken`, `category_not_empty`, `not_found`; the onboarding default stays `slug_taken`.

## 2. What this app is

Salu is a mobile-first, self-serve dining platform. A diner scans the QR code on their table, browses the menu, orders, and (from Phase 3) pays from their phone with no app download and no staff interaction. Restaurants manage menus, tables, QR codes and a live order board in a web portal. The failure mode it exists to prevent: a diner who wants to order and cannot, or an order that reaches the kitchen with a price the diner set.

**Current phase:** Phase 1, "walking skeleton": restaurant portal plus QR scan, menu, order, and a live staff order board. No payments yet.
**Active brief:** `docs/phase-1/BRIEF-02-portal.md`. Do the active brief only. Don't start the next brief until Ari merges the current PR.

Source of truth, in priority order:
1. This file (the rules in section 4 are not negotiable)
2. The active brief in `docs/phase-1/`
3. `docs/phase-1/SCAFFOLD-PLAN.md` (target structure and tooling)
4. The Salu PRD in Notion (product and design spec). The repo docs carry what you need to build, so you don't need Notion access.

If these disagree, stop and ask Ari. Don't guess.

## 3. Roles

- **Ari (PM, owner):** decides product, security rulings, open decisions and the order state machine. Reviews and merges every PR. Alone touches the hosted Supabase project, Vercel settings and real credentials.
- **Claude Code (builder):** builds the active brief against local Supabase, tests, opens one PR per brief, and stops. Never commits to `main`, never changes a remote database.
- **Restaurant staff and diners:** never read code or these docs. The PRD speaks for them.

## 4. Non-negotiable rules

Cite by number: security invariants `1`–`10`, architecture `A1`–`A9`, database `D1`–`D4`, UI `U1`–`U6`, guardrails `G1`–`G6`, stop-and-ask `S1`–`S4`.

### Security invariants

Ari treats security as a first-rate requirement, even in development. Violating any of these is a blocking defect.

1. **RLS on every table**, plus explicit minimum grants. New tables get `enable row level security`, policies, and grants in the *same* migration. Default privileges are revoked, so nothing is exposed by accident.
2. **Diners are anonymous Supabase users.** Call `supabase.auth.signInAnonymously()` on first QR scan. Diners never create email or password accounts in Phase 1.
3. **Diners never read `dining_tables` or QR tokens.** The only diner entry point is the `join_table(qr_token)` RPC.
4. **Orders are only created through the `place_order` RPC.** The client sends item ids, quantities and notes. **Never send or trust a price from the client.** The database snapshots names and prices.
5. **Staff order updates change `status` only**, through the DB state machine (`submitted → accepted → preparing → ready → served`, or `cancelled`). Column grants enforce this. Don't widen them. **Orders, sessions and tables with history are never hard-deleted** (FKs are `on delete restrict`). Cancel orders and deactivate tables instead. Realtime DELETE events aren't RLS-filtered the way inserts and updates are, which is one more reason to avoid deletes.
   Floor staff (`role = staff`) can 86 items only through `set_item_availability()`. Price and name edits are owner/manager-only.
6. **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` may reach the browser. The secret key (`sb_secret_...`) is server-only, used only where RLS can't apply, and is **not needed in Phase 1**. Never prefix a secret with `NEXT_PUBLIC_`. Never commit `.env*` files except `.env.example`.
7. **Verify identity on the server with `supabase.auth.getClaims()`** in Server Components, Server Actions and Route Handlers. Never trust `getSession()` user data for authorization. RLS is the real boundary. UI checks are convenience only.
8. **`SECURITY DEFINER` functions** pin `set search_path = ''`, fully qualify every object, check `auth.uid()` and membership themselves, `revoke all ... from public, anon`, and grant execute only to `authenticated`. Put helpers in schema `private` (not exposed via the Data API).
9. **Validate every input twice:** zod in the Server Action, then constraints and checks in the database.
10. **No remote database changes from Claude Code.** Build and test against local Supabase only. Ari applies migrations to the hosted project.

### Architecture rules

- **A1. Routes.**
  - Diner: `/t/[token]` (entry), `/t/[token]/menu`, `/t/[token]/cart`, `/t/[token]/orders/[orderId]`. The token URL is the diner's home, and each server render re-resolves the session through RLS.
  - Staff: `/login`, `/restaurant/onboarding`, `/restaurant/(portal)/{dashboard,orders,menu,tables,settings}`.
- **A2. Proxy, not middleware.** Next.js 16 renamed `middleware.ts` to `proxy.ts`. Session refresh lives in `src/proxy.ts` and calls `src/lib/supabase/proxy.ts`. Don't create `middleware.ts`.
- **A3. Server Components by default.** Use `'use client'` only for interactivity (cart, steppers, realtime board).
- **A4. Mutations are Server Actions** in a colocated `actions.ts`. Each one: zod parse, user-scoped server Supabase client, RPC or table call, typed result `{ ok: true, data } | { ok: false, error: { code, message } }`. Map DB error hints (`invalid_table`, `item_unavailable`, `session_closed`, `rate_limited`, `invalid_transition`) to friendly copy in `src/lib/errors.ts`.
- **A5. Realtime:** subscribe to `postgres_changes` on `public.orders`, filtered by `restaurant_id` (staff) or by order `id` (diner). RLS filters rows per subscriber. Always unsubscribe on unmount, and refetch on reconnect.
- **A6. Money:** integer cents everywhere. Format only through `src/lib/money.ts`. Never use floats for currency.
- **A7. Time:** `timestamptz` in the DB. Render in the restaurant's timezone for staff and the device timezone for diners.
- **A8. All Supabase access goes through `src/lib/`.** Only files under `src/lib/` import `@supabase/*` or call the Supabase client. Pages, components and Server Actions call functions in `src/lib/` (e.g. `src/lib/orders.ts`, `src/lib/realtime.ts`). This is the portability seam: if Salu ever leaves hosted Supabase, the change stays inside `src/lib/`. The pre-commit hook enforces the import rule. **Generated types:** import DB types from `src/lib/db/types.ts` (generated). Never hand-write row types.
- **A9. Pages that touch auth render dynamically.** Never statically cache pages with user-specific or anonymous-user data (Supabase flags metadata leaking across anonymous users under static rendering).

### Database workflow

- **D1.** Every schema change gets a **new** file in `supabase/migrations/` (`supabase migration new <name>`). Never edit a migration after it has been applied anywhere.
- **D2.** Every new policy, grant or RPC gets pgTAP coverage in `supabase/tests/database/`, including a **negative** test (the wrong user is denied).
- **D3.** After schema changes: `npm run db:reset && npm run db:test && npm run db:types`.
- **D4.** Keep `supabase/seed.sql` realistic but fake: one demo restaurant, 3 categories, about 12 items, 4 tables. No real personal data.

### UI conventions

- **U1. Diner UI** is light by default and respects `prefers-color-scheme`. It's one-handed and thumb-first: primary actions sit in the bottom 40% of the screen, and touch targets are at least 44×44px.
- **U2. Staff portal** is dark by default (Ari's request). It's designed for a tablet on a pass or counter, so text must be readable at arm's length.
- **U3. Colors come from design tokens** in `globals.css` (`--color-brand`, `--color-surface`, and so on). No raw hex in components. The brand color is **not final** (open decision 1), so keep it a token.
- **U4. Accessibility:** WCAG 2.2 AA. Every control needs a label, focus must be visible, respect `prefers-reduced-motion`, and color is never the only signal (status badges need text).
- **U5. Copy:** short, warm, plain. "Your order's in. The kitchen has it." beats "Order submitted successfully."
- **U6. Handle every state:** loading (skeletons), empty, error, offline.

### Guardrails and git

- **G1. Pre-commit hook** (`.githooks/pre-commit`) blocks the mechanical violations of this file on staged lines: `middleware.ts`, `.env` files, secret key literals, secret-looking `NEXT_PUBLIC_` names, Tailwind v3 directives, Supabase imports outside `src/lib/`, raw hex colors in components. It warns on `getSession()`, hard deletes, direct order inserts, `force-static` and float-looking money. `npm install` activates it (the `prepare` script sets `core.hooksPath`). **Never use `--no-verify` without asking Ari.**
- **G2. Spec-reconciliation agent** (`.claude/agents/spec-reconciliation.md`) is a read-only audit of the code against this file, the active brief, the scaffold plan and the PRD. Run it before opening every PR.
- **G3. Falsification check** for new security tests: break the policy or RPC, watch the pgTAP test fail, restore it. Say in the PR which tests you checked this way.
- **G4. Branch per brief:** `phase-1/brief-01-foundation`, `phase-1/brief-02-portal`, and so on. **Never commit to `main`.** Concurrent streams use `git worktree`, cut from `main`.
- **G5. Conventional commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Commit only when asked; draft the message so the ask costs one word.
- **G6. Open a PR to `main` and stop.** Ari reviews and merges.

### When to stop and ask Ari

- **S1.** Any change to a security invariant, RLS policy intent, or the order state machine
- **S2.** Any new dependency or external service
- **S3.** Anything that needs the hosted Supabase project, Vercel settings, or real credentials
- **S4.** A brief that is ambiguous or conflicts with this file

## 5. Stack

Pinned. Do not switch or add dependencies without a PM call (rule S2).

- **Next.js 16** App Router, **React 19**, **TypeScript strict**
- **Tailwind CSS v4.** CSS-first config: `@import "tailwindcss";` plus `@theme` in `globals.css`. Never write v3 `@tailwind base/components/utilities` directives. They caused the broken dark theme in the February prototype.
- **Supabase**: Postgres 17, Auth (email+password for staff, **anonymous sign-ins for diners**), Realtime (Postgres Changes on `orders`)
- **@supabase/ssr** for cookie sessions, **zod** for validation, **qrcode** for QR images
- **Cloudflare Turnstile** on sign-in and sign-up (from Brief 03; see `docs/phase-1/README.md`)
- **Vitest** for unit tests, **Playwright** for e2e, **pgTAP** via `supabase test db` for database tests
- **Vercel** hosting, GitHub-connected. Every PR gets a preview deployment.
- Later phases only (don't install yet): Stripe, web push, Sentry
- Node 22 (`.nvmrc`). Local containers via colima. Local mail via Mailpit on 54324.

### Commands

```bash
npm run dev            # Next.js dev server (localhost:3000)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest
npm run test:e2e       # Playwright (needs local Supabase running)
npm run db:start       # supabase start (colima must be running)
npm run db:reset       # supabase db reset: re-applies all migrations + seed
npm run db:test        # supabase test db (pgTAP)
npm run db:types       # regenerate src/lib/db/types.ts from local DB
npm run check          # lint + typecheck + test + db:test (run before every commit)
```

## 6. Known open decisions

Numbered, never reused or deleted. STOP and ask; do not guess. When ruled: strike the title, write `RESOLVED YYYY-MM-DD (option X)` and the outcome in place, in the same commit that ships the ruling.

1. **Brand color.** Blue `#3848D0` (design board) vs green `#2ECC8E` (February portal). Tokenized as `--color-brand` meanwhile. No recommendation recorded.
2. ~~**`NEXT_PUBLIC_SITE_URL` and invariant 6.**~~ RESOLVED 2026-09-29 (add to invariant 6). Listed as browser-safe; no code change.
3. ~~**Restaurant timezone at onboarding.**~~ RESOLVED 2026-09-29 (Brief 02 Settings). Onboarding stays name + slug; default `America/New_York` until Settings ships.
4. ~~**`server-only` package.**~~ RESOLVED 2026-09-29 (add in Brief 02). Approved dependency.
5. **Does the no-deletes rule (invariant 5) cover the secret key?** `service_role` has delete grants, and `session_participants` / `order_items` cascade from their parents, so the secret key could hard-delete history. If yes: a new migration in a later brief. Not blocking in Phase 1 (the secret key is unused).
6. **Which brief gets password reset (PRD P1) and the PWA manifest and icons (scaffold tree)?** Both are spec gaps with no home. No recommendation recorded.
7. ~~**Turnstile on staff forms.**~~ RESOLVED 2026-09-29 (verify locally in Brief 03, then add where required).
8. **Database checks for `restaurants.timezone` and `menu_items.dietary_tags` (invariant 9 half-met).** zod validates both; the database accepts any text, and Brief 02 is the first write path for both. Proposal (not applied, rule S1): one migration adding `check (dietary_tags <@ array['vegetarian','vegan','gluten-free','dairy-free','contains-nuts','spicy']::text[])` and a trigger that rejects a `timezone` missing from `pg_timezone_names` (a check constraint cannot query). Recommendation: yes, as the first migration of Brief 03, before diners read tags. Shipped mitigation: the kitchen clock no longer crashes the portal on an unknown zone.
9. **Discontinued menu items: delete (current) or a hide flag?** Brief 02 deletes; order history keeps its snapshot (pgTAP portal test 25). A `menu_items.is_active` column would let owners re-list seasonal items. Recommendation: keep delete for Phase 1; revisit with modifiers in Phase 2.
10. **Table delete: PRD 5.10 grants owners and managers "CRUD" on tables; Brief 02 ships no delete (builder call (a)).** Rule 5 forbids deleting tables with history; an unused table could be deleted. Recommendation: amend the PRD matrix to "create, edit, deactivate, rotate QR" and keep delete out of the UI.

## 7. Definition of done

A gate is one brief. "Done" means both halves.

**Automated check, every brief:**
- [ ] `npm run check` passes locally. CI is green.
- [ ] Spec-reconciliation agent run; its summary line is in the PR description and every divergence is fixed or explained.
- [ ] New or changed DB behavior has pgTAP tests, including negative cases, with a falsification record in the PR (rule G3).
- [ ] Happy-path Playwright test updated when a user flow changes.
- [ ] No secrets in the diff. `.env.example` updated if env vars changed.
- [ ] Screens checked at 390×844 (diner) and 1024×768 (staff).
- [ ] PR description covers what changed, how to test, screenshots, and any decisions made. Decisions go in section 1 of this file in the same PR.

**PM acceptance test, per gate** (Ari, on the Vercel preview or a local run):
- **Brief 01:** sign up, confirm the email, create a restaurant, land on the dashboard with a correct setup checklist; an anonymous visit to `/restaurant/*` redirects to `/login`. Then merge.
- **Brief 02:** create a category and item, 86 it inline, add a table, print the QR sheet, rotate a QR, set the edit window. Then merge.
- **Brief 03:** scan a table QR on a phone, order, see the status page update; invalid, rotated and closed-table states behave. Then merge.
- **Brief 04 (Phase 1 exit):** the criteria in `docs/phase-1/README.md`, including one "fake dinner" with 2+ phones at one table on iPhone Safari.

## 8. Handoff status

Current state only. History is in section 1.

**Stream: Brief 01** — `MERGED @ c52c3e2` (PR #2, 2026-09-29). Branch `phase-1/brief-01-foundation` can be deleted after Brief 02 merges. Gate `PM-ACCEPTED` is implied by Ari's merge; the acceptance run on the Vercel preview was not separately recorded.

**Stream: Brief 02** — `phase-1/brief-02-portal`, cut from `main @ c52c3e2`, PR #3 (https://github.com/aricompa/salu/pull/3) · worktree `/Users/ari/salu` · committed and pushed; nothing uncommitted · desk (2026-09-29): lint, typecheck, format, Vitest 134/134 (18 files), pgTAP 68/68, `supabase db lint` clean, types no drift, production build (all `/restaurant/*` dynamic), Playwright 5/5 on the production build · gate **DESK-GREEN**; CI: see PR #3 checks (pickup step 1 verifies); PM acceptance pending; review file `PM_REVIEW_brief-02.md` · next: Ari reviews PR #3 and rules on open decisions 8, 9, 10 and builder calls (a) to (m).

All seven Brief 02 tasks are built. Commits: `519268c` brief docs, `aee93a8` task 1, `4f3695c` tasks 2 and 3, `fb7b2bb` tasks 4 and 5, `750a23e` task 6, `61ff087` task 7 tests and screenshots, `2a908a1` audit fixes, `272ffff` handoff, then the PM review file and the row-count guard test.

**PICK UP HERE** (run top to bottom):
1. `git fetch && gh pr view 3 --json state,mergedAt,mergeCommit,statusCheckRollup` → note state and CI conclusion. A failing check is reported as failing, with its log.
2. If PR #3 is open: stop. Brief 03 does not start (section 2). Answer review comments on the branch only.
3. If merged: `git checkout main && git pull`, record `MERGED @ <sha>` for Brief 02 here, move `server-only`, time zone and portal rows forward in section 10, and point "Active brief" at Brief 03.
4. Write `docs/phase-1/BRIEF-03-diner.md` from the README outline plus: open decision 8's migration (if ruled yes) as its first task, open decision 7's Turnstile check, the sold-out copy that names the item (section 9), and PRD P3's "place a test order" link.
5. `npm run db:start && npm run db:reset && npm run check` → green before any Brief 03 code.

## 9. Gated / deferred items

Each with the test that flips if it is ever gated in.

- **Sold-out copy naming the item** (spec audit, left for Brief 03): needs the item name from `place_order`. Flips: the `errors.ts` drift test gains an `item_unavailable` case with a name.
- **Secret-key hard deletes** (open decision 5): not fixed. Flips: a pgTAP negative test that `service_role` cannot delete from `orders`, `order_items`, `table_sessions`, `session_participants`.
- **Password reset, PWA manifest and icons** (open decision 6): not built. Flips: an e2e for reset; a Playwright check that `/manifest.webmanifest` serves.
- **Turnstile** (Brief 03): not built. Flips: a local sign-in with CAPTCHA on and no token must fail.
- **DB checks on time zone and dietary tags** (open decision 8): proposed, not built. Flips: pgTAP tests that an owner cannot store `timezone = 'Mars/Olympus'` or a tag outside the vocabulary.
- **Floor-staff e2e** (2026-09-29 log): not built; render tests and pgTAP only. Flips: when staff invites ship (Phase 2), an e2e signs in as `role = staff` and sees only the 86 switch on the menu, no tokens on tables, and 404 on the print sheet.
- **Toast primitive** (builder call (i)): not built. Flips: a render test that a toast announces through `role="status"` and respects reduced motion; the rotate confirmation moves to it.
- **`qrcode` import rule**: rule A8 keeps it under `src/lib/`, but the pre-commit hook only checks `@supabase/*`. Flips: the hook blocks `from "qrcode"` outside `src/lib/`.

## 10. Coverage state

A clean desk suite never reads as validated.

| Surface | Desk-only | Validated (hosted preview) | On-device |
|---|---|---|---|
| Schema, RLS, RPC grants | pgTAP 68/68: 43 security + 25 portal (2026-09-29); 7 pgTAP falsification probes (2 in PR #2, 5 in PR #3); PR #3 also probed `server-only`, the seed drift guard and the row-count guard | not run against the hosted project by Claude Code (rule 10) | n/a |
| lib, validation, UI primitives, portal components | Vitest 134/134, 18 files (2026-09-29) | n/a | n/a |
| Staff sign-up → confirm → onboarding → dashboard | Playwright 2/2, Chromium, local production build (2026-09-29) and CI | Vercel preview builds; Ari's acceptance run: **unverified** | none |
| Portal as owner: menu, 86, tables, QR rotation, print sheet, settings | Playwright 3/3, local production build (2026-09-29); print sheet PDF 2 pages for 7 tables on Letter and A4, 7/7 codes decoded by Chromium `BarcodeDetector` | **unverified** | a printed card scanned by a phone: **none** |
| Portal as floor staff | render tests + pgTAP only | none | none |
| Diner flow, order board | not built | not built | none |
| iPhone Safari, real QR | n/a | n/a | none until Brief 04 |

## 11. Backlog

Pre-registered bright lines that later delivery pressure cannot relax: security invariants 1–10; no hard deletes of history; no client-supplied prices; no `middleware.ts`; no `NEXT_PUBLIC_` secrets; no hosted DB changes from Claude Code.

- **Phase 1, Briefs 02–04:** see `docs/phase-1/README.md`. Each brief is written in full after the previous PR merges.
- **Phase 2:** 30-day anonymous-user purge; idle-session auto-close; anything from open decision 6 not placed earlier.
- **Phase 3:** payments (Stripe). Not before then.
- **Phase 4:** shared-table order visibility (2026-09-28 log entry).
- **Phase 5:** load test Realtime against plan limits; switch Postgres Changes to Broadcast from the database with private channels if needed (should stay inside `src/lib/` plus one migration). Web push, Sentry.
- **Tooling:** upgrade to TypeScript 6.1+ and ESLint 10 when eslint-config-next supports them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
