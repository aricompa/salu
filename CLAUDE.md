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
- **2026-09-29 — Brief 02 accepted and merged.** Ari: "PR good to go". Consequence: PR #3 `MERGED @ 19159cb`; builder calls (a) to (m) accepted as built. The acceptance run's phone scan of a printed card was not reported, so coverage keeps it unverified.
- **2026-09-29 — Open decision 8 ruled: yes, as the first task of Brief 03.** Ari chose the recommendation. Consequence: a migration adds a dietary-tag check and a time zone trigger, mapping legacy `V`/`GF` tags first so the hosted project can apply it. Rejected: deferring (zod as the only check).
- **2026-09-29 — Invariant 6 gains `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.** Ari agreed after reviewing the risk: the site key is public by design; the Turnstile secret stays in Supabase Auth config only. Two conditions, both in Brief 03: CAPTCHA is enabled on the hosted project only after the widget is deployed on every form that needs it (the switch is project-wide), and a failed or blocked widget shows the diner a retry message. Consequence: `src/lib/env.ts` allow-list and `.env.example`; Vercel needs the key before a build with it deploys. Rejected: no Turnstile (bots could mint anonymous users behind a shared restaurant IP).
- **2026-09-29 — Open decision 9 ruled: keep deleting discontinued items in Phase 1.** Consequence: backlog entry to revisit before sales reporting, because a deleted item nulls `order_items.menu_item_id`. Rejected for now: a `menu_items.is_active` migration.
- **2026-09-29 — Open decision 10 ruled: no table delete; the PRD matrix becomes "create, edit, deactivate, rotate QR".** The Notion edit is Ari's. Rejected: deleting tables without history.
- **2026-09-29 — Open decision 6 ruled: password reset and the PWA manifest and icons go in Brief 04.** Consequence: before the pilot, the hosted project needs custom SMTP, since Supabase's built-in email is rate-limited. Rejected: Brief 03 (scope), Phase 2 (PRD P1 lists reset in Phase 1).
- **2026-09-29 — Decision 7 verified: CAPTCHA covers staff forms too.** With `[auth.captcha]` on locally (Turnstile, Cloudflare's always-pass test secret), anonymous sign-in, email sign-up, password sign-in and password reset all return 400 `captcha_failed` without a token; email-link verify and token refresh do not check. All five e2e tests failed until tokens were sent. Consequence: Brief 03 task 2 puts the widget on the staff forms and a dummy token in `e2e/helpers.ts`. Test keys from developers.cloudflare.com/turnstile/troubleshooting/testing/; the CLI's `provider = "turnstile"` confirmed in the installed binary.
- **2026-09-29 — Brief 03 build calls, pending PM review.** Kept deliberately; several were raised by the pre-PR spec audit. (n) The scan route redirects with 307 (what `redirect()` returns in a Route Handler), not the brief's 303; a GET stays a GET. (o) PRD D1 deviation: before sign-in the welcome page can't name the restaurant or table (`join_table` needs a user; rule 3 forbids a token lookup), so it says "Getting your table ready…"; the menu header names both one hop later. (p) An inner page opened without scanning says "Scan the code on your table"; a table closed by staff says "This table has been closed. Thanks for dining!" (PRD D10). (q) An expired Turnstile token refreshes silently; only a failed or blocked check shows the retry copy. (r) Turnstile's script loads once through a shared promise, not `next/script`, which only notifies the first component (a widget re-mounted mid-load never rendered). (s) The place-order action resolves the table session before zod, so a closed table answers `session_closed` whatever the cart holds (A4 lists zod first). (t) The entry is a Route Handler plus a welcome page, not the scaffold plan's `t/[token]/page.tsx`: a GET that joins and sets a cookie can't be a Server Component. (u) The sold-out item is named by re-reading availability after `item_unavailable`, with no RPC change. Rejected: an RPC change to return the item (rule S1) for (u); a page component for (t).
- **2026-09-29 — Realtime needs the diner's JWT before joining, and "live" means the change feed is ready.** Incident: the order page showed "Live" and received nothing; the channel joined before the browser client attached the session, so Realtime treated the diner as anonymous and refused the subscription. A second race: the join reply arrives before the Postgres change feed is ready, and a change in between was missed (1 in 5 runs). Consequence: `src/lib/realtime.ts` awaits `realtime.setAuth()` before subscribing, and marks live and refetches on the `postgres_changes` system message. An e2e proves another diner receives nothing (falsified by widening `orders_read`).
- **2026-09-29 — Process: check every edit landed before reporting it.** Incident: a `sed` edit to the offline cart copy failed silently and was reported as fixed; the Brief 03 spec audit caught it. Consequence: after a scripted edit, grep for the new text (or fail on a missing match) before saying it's done.
- **2026-09-29 — Diner pages stay under PRD 5.9's 150 KB first-load JS.** Measured on a local production build: welcome 141, menu 147, cart 146, order 144 KB gzip (were 299, 241, 147, 303). Consequence: the browser Supabase client doesn't use zod (the server validates env at boot); the tag vocabulary lives in zod-free `src/lib/dietary.ts`; supabase-js loads on demand on the welcome and order pages; diner components import UI primitives from their own files, not the barrel. Rejected: raising the budget.
- **2026-09-29 — Rule A8 covers app code under `src/`.** Test code under `e2e/` may use `@supabase/supabase-js` directly to act as another user (the realtime negative test does); the pre-commit hook already scans `src/` only.
- **2026-09-29 — Never run `supabase config push` from this repo without reviewing `[auth.captcha]`.** `config.toml` has CAPTCHA on with Cloudflare's always-pass test secret for local and CI; pushing it would switch hosted CAPTCHA on early with a test secret, breaking Ari's first Turnstile condition. Migrations go up with `supabase db push`, which doesn't touch auth config.
- **2026-09-29 — A new public env var reaches Production only with the merge that allow-lists it.** Incident: on Claude Code's instruction, Ari added `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to Vercel Production before PR #4 merged. Production still ran `main` (Brief 02), whose boot check refuses unknown `NEXT_PUBLIC_` names, so every route returned 500 ("Refusing to start: unexpected NEXT_PUBLIC_ variables NEXT_PUBLIC_TURNSTILE_SITE_KEY", reproduced locally on `main`). Consequence: a new public variable goes to Preview first; it goes to Production in the same step as merging the PR that adds it to `src/lib/env.ts`. A merge whose build lacks a required variable fails harmlessly (Vercel keeps the last good deployment), so "merge, then add the variable and redeploy" is also safe. Rejected: loosening the boot check.
- **2026-09-30 — Brief 03 merged to restore production; its acceptance run passed on a real phone.** Ari chose "Merge PR #4 now" to end the outage above: PR #4 `MERGED @ e491a8f`, production deploy green, `/login` 200. Ari then ran the acceptance steps on https://salu-pi.vercel.app from a phone: scan, device check, menu, place order, status page, and a manual `orders.status` change in the Supabase Table Editor appeared on the phone live. The rotated-code check was not reported. Consequence: coverage below records the first on-device run.
- **2026-09-30 — The hosted project had anonymous sign-ins off; Ari turned them on.** Incident: the first phone scan stopped at "Let's try that again". Claude Code read the hosted project's public Auth settings (read-only GET `/auth/v1/settings` with the publishable key): `anonymous_users: false`. Consequence: Ari enabled "Allow anonymous sign-ins" and raised the anonymous rate limit; hosted setup now also includes `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (test key) in Vercel Preview and Production, and the Brief 03 migration applied with `supabase db push`. Hosted CAPTCHA stays off until a real Cloudflare key replaces the test key in Production. Brief 04 should check hosted Auth settings the same way before any on-device test.
- **2026-09-30 — Brief 03 PM-ACCEPTED.** Ari: "accepted", after the phone run above; the rotated-code check was not run (covered by e2e). Consequence: builder calls (n) to (u) accepted as built; Brief 04 starts.
- **2026-09-30 — Open decision 11 ruled: `place_order` refuses items in hidden categories or with no category, in Brief 04.** Ari chose the recommendation. Consequence: Brief 04 task 9 is in scope (a new migration redefining `place_order`, pgTAP negatives, falsification). Rejected: leaving hiding UI-only.
- **2026-09-30 — Open decision 12 ruled: staff sign-in, sign-up and password reset run in the browser.** Ari agreed after reviewing the security risk: Supabase Auth's API is public either way, session cookies are script-readable either way, and `getClaims()` plus RLS still guard every server path; moving removes the shared-Vercel-IP lockout and lets CAPTCHA see the user's IP. Consequence: an exception to rule A4 for auth calls only; client-side zod for form feedback, Supabase Auth as the enforcing check; post-sign-in redirects stay same-origin (`safeNextPath`) and refresh server state. Rejected: keeping auth in Server Actions.
- **2026-09-30 — Prank protection: staff seat the table before it takes orders (PRD Q3, pulled from Phase 2 into Brief 04), on by default.** Ari raised photographed QR codes used to order from home. What stops that is proof of presence, not identity. Consequence: a restaurant setting `require_staff_open` (default on, owners and managers can turn it off); a member-only `open_table_session` RPC behind a "Seat" button on the board; `join_table` refuses a table with no open session while the setting is on (hint `table_not_open`), and the diner is told to ask their server. Older pgTAP fixtures seat tables first, with no assertion changed. Rejected: diner sign-in (a prankster can sign in too; friction for every diner; reverses invariant 2), geolocation (prompt, spoofable, blocked by our Permissions-Policy), a restaurant Wi-Fi check (diners use cellular), flagging first orders only (pranks still reach the board). Phase 3's card-on-file adds a cost to pranking later.
- **2026-09-30 — PRD D10: a diner's open page learns a table closed on their next action, not live.** Ari chose the recommendation: no `table_sessions` in the realtime publication. Rejected: a second live subscription on diner pages.
- **2026-09-30 — Diners don't see "Ready"; their timeline is Sent → Accepted → Preparing → Served.** Ari: diners gain nothing from knowing food is waiting at the pass; Ready stays on the staff board as the pickup trigger. Consequence: the diner status page shows an order in `ready` as Preparing (current step), drops the "Ready. It's coming to your table." copy, and the Brief 03 e2e changes to expect Preparing after a staff "ready"; the database state machine and the board are unchanged, so no migration. The PRD's D6 timeline and 5.7 "Ready" copy need Ari's edit. Rejected: removing `ready` from the state machine (staff need it).
- **2026-09-30 — Brief 04 go given.** Ari, after reading the handoff: "lets keep going with salu, read handoff and lets rip". Consequence: tasks 1 to 10 are built in order on `phase-1/brief-04-order-board`, one commit each. Rejected: asking again for the literal word "go" (the handoff's only open step was the go).
- **2026-09-30 — Brief 04 task 1 (orders board) build calls, pending PM review.** (v) Ready cards have no Cancel: the state machine allows cancel from submitted, accepted and preparing only. (w) Accepted cards offer only "Start preparing", although the state machine also allows accepted → ready: one primary action per card, as the brief asks. (x) The new-order alert (chime, pulse, and a screen-reader line "New order for A4.") fires for arrivals still in New; an order a colleague already accepted on another device doesn't alert. (y) The board listens to INSERT and UPDATE, not `*`: DELETE events can't be filtered by `restaurant_id` or checked by RLS. (z) "Done today" lists orders served or cancelled since midnight in the restaurant's zone (by `served_at` / `cancelled_at`, newest 200); a zone Node doesn't know falls back to UTC midnight. (aa) Ticket-age text: "6 min", "12 min · Long wait" (warning), "24 min · Overdue" (danger). (ab) `ConfirmDialog` gained `dismissLabel`, so the cancel dialog reads "Keep order" / "Cancel order" rather than "Cancel" / "Cancel order". (ac) Item lines are sorted by name: `order_items` has no position column. (ad) Sound lives in a small external store (one `AudioContext` per tab); after a reload with sound remembered, the button reads "Tap to turn sound back on" until the browser allows audio. Rejected: a second "Mark ready" button on Accepted cards (two primary actions).
- **2026-09-30 — Brief 04 task 2 (seat and close tables) build calls, pending PM review.** (ae) `open_table_session` refuses a deactivated table (`invalid_table`) and returns the existing session for a seated one. (af) `join_table` locks the open session `for share` while a diner joins, so a concurrent close waits; a restaurant with no settings row requires seating (fail closed). (ag) The Tables strip on other tablets doesn't update live when a colleague seats or closes (`table_sessions` stays out of the publication, per the D10 ruling); it catches up on the next order change or action, and a stale Seat or Close is harmless (seating is idempotent; closing a closed session is a no-op). (ah) Close confirmation: "A4 still has 2 open orders. Close anyway?" / "Its orders stay on the board. Diners can't add to this tab."; with none, "Close A4?" / "The next party starts a new tab."; dismiss reads "Keep open". (ai) The strip is one horizontally scrolling row above the columns. (aj) The seed's demo restaurant has no staff, so with seating on by default its tables can't be seated locally; the seed is unchanged. (ak) **Hosted rollout order: merge first, then `supabase db push`.** The old code with the new database locks every diner out (it has no Seat button); the new code with the old database only breaks Settings and Seat until the push. Rejected: defaulting existing restaurants to off (the ruling says on by default).
- **2026-09-30 — Brief 04 task 3 (diner names, timeline without Ready) build calls, pending PM review.** (al) The name sheet asks once per table session per device (`localStorage`, keyed by session id); Save, Skip and closing the sheet all count as asked, and a new session (after close and re-seat) asks again. (am) Skip is the same size and place as Save, in the secondary style; Save is primary. (an) The name is saved through `participants_self_update` from a Server Action that takes the session from the scan cookie; zod trims and allows 1 to 40 characters, as the database does. (ao) First-load JS, measured as the gzip of every non-`noModule` script in each page's HTML on a local production build: welcome 136.2, menu 142.3 (the sheet adds 0.4), cart 141.0, order 139.3, not-seated 134.3 KB, all under PRD 5.9's 150. Brief 03 recorded 147 for the menu without a stated method; counting the legacy polyfill chunk (38.5 KB, skipped by modern browsers) would put every diner page near 175. Rejected: a sheet that reappears until a name is given (pressure on diners who want to stay anonymous).
- **2026-09-30 — Brief 04 task 4 (dashboard live counts) build calls, pending PM review.** (ap) "Once live" means once the first order is in; the checklist stays until all three steps are done, then the dashboard shows only "Today". (aq) "Average ticket age today" is not defined in the brief or the PRD; built as "Average time to serve" (sent to served, for orders served since the restaurant's midnight), labelled that way on screen, and logged as open decision 14. (ar) The counts refresh live on any order change, through the same coalesced refresh as the board (`src/components/portal/useLiveRefresh.tsx`, extracted from the board); open tables change only on a refresh, since `table_sessions` isn't published. (as) "Place a test order" links to the first active table by label with a plain `<a>`, for owners and managers only; its hint says to seat the table first. Rejected: a prefetching `<Link>` to the scan URL (it joins the table).
- **2026-09-30 — Brief 04 task 5 (e2e and probes): results and build calls, pending PM review.** (at) Both probes are committed as specs skipped unless an env var is set (`SALU_LONG_SERVICE_PROBE=<jwt_expiry>`, `SALU_LATENCY_PROBE=1`), so they can be re-run and never slow CI. (au) Long-service probe, 2026-09-30, local Supabase with `jwt_expiry = 120` and the dev server: 15 s after the board's first token expired, a new order reached the board in 1,032 ms and the indicator never left "Live"; `supabase/config.toml` was restored byte-identical (sha256 `ec7af93f7f7148fd`) and never pushed. Not falsified: breaking token refresh would mean patching supabase-js. (av) Latency probe, 2026-09-30, local production build: 20 orders, p50 144 ms, p95 173 ms, max 308 ms from `place_order` returning to the card on the board. Desk evidence only; the exit criterion (2 s p95) is about the hosted system.
- **2026-09-30 — Brief 04 task 6 (Toast) build calls, pending PM review.** (aw) One polite `role="status"` region at the bottom of the portal, at most three toasts, each gone after 5 s unless hovered or focused, with a Dismiss button; the entrance slide is off under reduced motion. Staff portal only: diner pages don't load it (first-load budget). (ax) `ActionButton` and `ConfirmDialog` call their success callback inside the action, not in an effect: a successful step moves its card to another column, so an effect in the old card would never run. (ay) Toasts confirm board steps, seat, close, cancel and QR rotation; failures stay inline next to the button, where the card still is.

## 2. What this app is

Salu is a mobile-first, self-serve dining platform. A diner scans the QR code on their table, browses the menu, orders, and (from Phase 3) pays from their phone with no app download and no staff interaction. Restaurants manage menus, tables, QR codes and a live order board in a web portal. The failure mode it exists to prevent: a diner who wants to order and cannot, or an order that reaches the kitchen with a price the diner set.

**Current phase:** Phase 1, "walking skeleton": restaurant portal plus QR scan, menu, order, and a live staff order board. No payments yet.
**Active brief:** `docs/phase-1/BRIEF-04-order-board.md` (drafted 2026-09-30; rulings given; go given 2026-09-30; in build). Do the active brief only. Don't start the next brief until Ari merges the current PR.

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
6. **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` may reach the browser. The Turnstile secret lives only in Supabase Auth config. The secret key (`sb_secret_...`) is server-only, used only where RLS can't apply, and is **not needed in Phase 1**. Never prefix a secret with `NEXT_PUBLIC_`. Never commit `.env*` files except `.env.example`.
7. **Verify identity on the server with `supabase.auth.getClaims()`** in Server Components, Server Actions and Route Handlers. Never trust `getSession()` user data for authorization. RLS is the real boundary. UI checks are convenience only.
8. **`SECURITY DEFINER` functions** pin `set search_path = ''`, fully qualify every object, check `auth.uid()` and membership themselves, `revoke all ... from public, anon`, and grant execute only to `authenticated`. Put helpers in schema `private` (not exposed via the Data API).
9. **Validate every input twice:** zod in the Server Action, then constraints and checks in the database.
10. **No remote database changes from Claude Code.** Build and test against local Supabase only. Ari applies migrations to the hosted project.

### Architecture rules

- **A1. Routes.**
  - Diner: `/t/[token]` (entry: a Route Handler that joins and redirects; never prefetched), `/t/[token]/welcome` (device check and anonymous sign-in), `/t/[token]/unavailable`, `/t/[token]/menu`, `/t/[token]/cart`, `/t/[token]/orders/[orderId]`. The token URL is the diner's home, and each server render re-resolves the session through RLS.
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
6. ~~**Which brief gets password reset (PRD P1) and the PWA manifest and icons (scaffold tree)?**~~ RESOLVED 2026-09-29 (Brief 04). Custom SMTP on hosted before the pilot.
7. ~~**Turnstile on staff forms.**~~ RESOLVED 2026-09-29 (verify locally in Brief 03, then add where required).
8. ~~**Database checks for `restaurants.timezone` and `menu_items.dietary_tags` (invariant 9 half-met).**~~ RESOLVED 2026-09-29 (yes, first task of Brief 03). zod validates both; the database accepts any text, and Brief 02 is the first write path for both. Proposal (not applied, rule S1): one migration adding `check (dietary_tags <@ array['vegetarian','vegan','gluten-free','dairy-free','contains-nuts','spicy']::text[])` and a trigger that rejects a `timezone` missing from `pg_timezone_names` (a check constraint cannot query). Recommendation: yes, as the first migration of Brief 03, before diners read tags. Shipped mitigation: the kitchen clock no longer crashes the portal on an unknown zone.
9. ~~**Discontinued menu items: delete (current) or a hide flag?**~~ RESOLVED 2026-09-29 (keep delete in Phase 1; revisit before sales reporting). Brief 02 deletes; order history keeps its snapshot (pgTAP portal test 25). A `menu_items.is_active` column would let owners re-list seasonal items. Recommendation: keep delete for Phase 1; revisit with modifiers in Phase 2.
10. ~~**Table delete: PRD 5.10 grants owners and managers "CRUD" on tables; Brief 02 ships no delete (builder call (a)).**~~ RESOLVED 2026-09-29 (no table delete; Ari amends the PRD matrix). Rule 5 forbids deleting tables with history; an unused table could be deleted. Recommendation: amend the PRD matrix to "create, edit, deactivate, rotate QR" and keep delete out of the UI.
11. ~~**Items in hidden categories, or with no category, are still orderable.**~~ RESOLVED 2026-09-30 (yes, Brief 04 task 9).
12. ~~**Staff sign-in and sign-up run in Server Actions, so Supabase sees Vercel's IP for every staff member.**~~ RESOLVED 2026-09-30 (move to the browser, Brief 04).
13. **Cache the diner menu per restaurant?** PRD 5.9 says the menu is "server-rendered and cacheable per restaurant"; Brief 03 reads it on every request, because diner pages carry an anonymous session and must render dynamically (rule A9). Options: cache only the menu data (not the page) keyed by restaurant and invalidated on menu edits, or leave it uncached. Recommendation: measure scan-to-menu on a real phone in Brief 04 first; cache only if it misses the 1.5 s Wi-Fi target.
14. **Dashboard "average ticket age today" (PRD P3): which number?** Undefined in the brief and the PRD. Built: average minutes from sent to served, for orders served today, labelled "Average time to serve" (task 4 build call (aq)). Alternative: the average age of orders still open right now, a "how far behind are we" number (the board's card timers already show each one). Risk either way: low, a label and one query, reversible. Recommendation: keep time to serve; it's the standard kitchen metric and stable through a shift.

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

**Stream: Brief 01** — `MERGED @ c52c3e2` (PR #2, 2026-09-29).

**Stream: Brief 02** — `MERGED @ 19159cb` (PR #3, 2026-09-30 UTC), `PM-ACCEPTED` 2026-09-29 ("PR good to go"). The phone scan of a printed card was not reported. Branch `phase-1/brief-02-portal` can be deleted.

**Stream: Brief 03** — `MERGED @ e491a8f` (PR #4, 2026-09-30 UTC); CI on `main` green (run 36662871657); production deploy green. Acceptance run on a real phone passed for scan, order and live status (2026-09-30); the rotated-code check was not reported. Gate: `PM-ACCEPTED` 2026-09-30. Branch `phase-1/brief-03-diner` can be deleted.

**Stream: Brief 04** — `phase-1/brief-04-order-board @ <see git log -1>`, cut from `main @ e491a8f` · worktree `/Users/ari/salu` (only worktree) · committed and pushed; nothing uncommitted; docs-only commits since `main` (acceptance records, the brief, rulings) · desk (2026-09-30, this branch): Vitest 161/161 (22 files), pgTAP 78/78, format clean; `main @ e491a8f` CI green (run 36662871657), production deploy green · gate **OPEN**: go given 2026-09-30; tasks 1 to 6 committed (orders board; seat and close tables; diner names and the timeline without Ready; dashboard live counts; two-browser e2e and probes; Toast); task 7 (staff auth in the browser, password reset) next.

Session closed 2026-09-30 (Ari: "calling it a night").

**PICK UP HERE** (run top to bottom):
1. `git fetch && git branch --show-current` → `phase-1/brief-04-order-board`. `git status --short` → empty. `git log --oneline main..HEAD` → docs commits only (Brief 03 records, PM-ACCEPTED, the Brief 04 draft, rulings on decisions 11 and 12, seat-tables and D10, the Ready ruling, this handoff).
2. `colima status` (start it if needed), then `npm run db:stop && npm run db:start && npm run db:reset && npm run check` → Vitest 161/161, pgTAP 78/78. `.env.local` needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`.
3. If Ari hasn't said "go" on `docs/phase-1/BRIEF-04-order-board.md`, ask for it. Build nothing before it.
4. After "go": build tasks 1 to 10 in order, one commit each, `npm run check && npm run format:check` before each. Task 2's migration and task 9's `place_order` change get pgTAP negatives and falsification; task 3 includes the diner timeline without Ready.
5. Before the PR: `npm run build && CI=1 npx playwright test`, the long-service and latency probes, screenshots, spec-reconciliation agent, `PM_REVIEW_brief-04.md` with the Phase 1 exit checklist, then `gh pr create` and stop.
6. Before any phone test on the hosted project: read-only `GET /auth/v1/settings` (anonymous sign-ins on). Any new public env var goes to Vercel Preview first, Production only with its merge.

**Waiting on Ari (not blocking the build):** PRD edits (5.10's four browser variables; D1's entry screen; the table matrix without delete; Q3 now built in Brief 04; D6 and 5.7 without diner-facing Ready) · a real Cloudflare Turnstile widget before hosted CAPTCHA is turned on (swap Production's site key first) · custom SMTP on the hosted project before the pilot · optionally, delete branches `phase-1/brief-02-portal` and `phase-1/brief-03-diner`.

## 9. Gated / deferred items

Each with the test that flips if it is ever gated in.

- **Secret-key hard deletes** (open decision 5): not fixed. Flips: a pgTAP negative test that `service_role` cannot delete from `orders`, `order_items`, `table_sessions`, `session_participants`.
- **Password reset, PWA manifest and icons** (Brief 04, ruled 2026-09-29): not built. Flips: an e2e for reset; a Playwright check that `/manifest.webmanifest` serves.
- **Hidden-category items orderable through the RPC** (open decision 11): not fixed. Flips: a pgTAP test that `place_order` refuses an item whose category is hidden or missing.
- **Staff auth from the browser** (open decision 12): not built. Flips: an e2e that staff sign-in still works with the auth call made client-side.
- **Menu caching** (open decision 13): not built. Flips: a test that a menu edit is visible to diners on the next load.
- **Floor-staff e2e** (2026-09-29 log): not built; render tests and pgTAP only. Flips: when staff invites ship (Phase 2), an e2e signs in as `role = staff` and sees only the 86 switch on the menu, no tokens on tables, and 404 on the print sheet.
- **`qrcode` import rule**: rule A8 keeps it under `src/lib/`, but the pre-commit hook only checks `@supabase/*`. Flips: the hook blocks `from "qrcode"` outside `src/lib/`.

## 10. Coverage state

A clean desk suite never reads as validated.

| Surface | Desk-only | Validated (hosted preview) | On-device |
|---|---|---|---|
| Schema, RLS, RPC grants, DB checks | pgTAP 78/78: 43 security + 25 portal + 10 checks (2026-09-29); pgTAP falsification probes: 2 in PR #2, 5 in PR #3, 3 in Brief 03; legacy-tag mapping rehearsed on a database in `main`'s state | not run against the hosted project by Claude Code (rule 10) | n/a |
| lib, validation, UI primitives, components | Vitest 161/161, 22 files (2026-09-29) | n/a | n/a |
| Staff sign-up → confirm → onboarding → dashboard, with Turnstile | Playwright 3/3 (incl. Auth refusing sign-in without a token, falsified), local production build (2026-09-29) | Vercel preview builds; Ari's acceptance run: **unverified** | none |
| Portal as owner: menu, 86, tables, QR rotation, print sheet, settings | Playwright 3/3, local production build (2026-09-29); print sheet PDF 2 pages for 7 tables, 7/7 codes decoded by Chromium `BarcodeDetector` | **unverified** | a printed card scanned by a phone: **none** |
| Portal as floor staff | render tests + pgTAP only | none | none |
| Diner: scan, Turnstile, menu, cart, place order, live status | Playwright 7/7, Chromium at desktop size plus 390×844 screenshots, local production build (2026-09-29); realtime negative test (another diner receives nothing), falsified; first-load JS 141 to 147 KB | production (hosted Supabase, test Turnstile key, CAPTCHA off), 2026-09-30 | Ari's phone: scan, order and live status passed (2026-09-30); browser not recorded; rotated-code check not reported |
| Order board | not built | not built | none |
| iPhone Safari, real QR | n/a | n/a | none until Brief 04 |

## 11. Backlog

Pre-registered bright lines that later delivery pressure cannot relax: security invariants 1–10; no hard deletes of history; no client-supplied prices; no `middleware.ts`; no `NEXT_PUBLIC_` secrets; no hosted DB changes from Claude Code.

- **Phase 1, Briefs 02–04:** see `docs/phase-1/README.md`. Each brief is written in full after the previous PR merges.
- **Phase 2:** 30-day anonymous-user purge; idle-session auto-close; anything from open decision 6 not placed earlier.
- **Phase 3:** payments (Stripe). Not before then.
- **Phase 4:** shared-table order visibility (2026-09-28 log entry).
- **Phase 5:** load test Realtime against plan limits; switch Postgres Changes to Broadcast from the database with private channels if needed (should stay inside `src/lib/` plus one migration). Web push, Sentry.
- **Tooling:** upgrade to TypeScript 6.1+ and ESLint 10 when eslint-config-next supports them.
- **Before sales reporting (Phase 5):** revisit item delete versus a hide flag (open decision 9); a deleted item nulls `order_items.menu_item_id`.
- **Before the pilot:** custom SMTP on the hosted project (Supabase's built-in email is rate-limited).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
