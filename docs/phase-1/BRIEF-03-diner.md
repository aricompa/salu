# Brief 03: Diner flow

**Phase:** 1 (walking skeleton) · **Branch:** `phase-1/brief-03-diner` · **Cut from:** `main @ 19159cb` · **Size:** about 4 to 6 focused sessions

## Objective

A diner scans a table's QR code, lands on the menu with no account and no forms, builds a cart, places an order, and watches its status change live. The security model already in the database does the enforcing: diners are anonymous Supabase users, reach a table only through `join_table(qr_token)`, and order only through `place_order`, which prices everything from the database. When this merges, Brief 04 builds the staff order board against real orders.

## Read first

1. `CLAUDE.md`: section 4 (rules, cited by number below), section 1's 2026-09-29 entries (decision 8, invariant 6 and its two conditions, decision 7's verification)
2. This brief, then the PRD screens quoted below (D1, D3, D4, D5, D6, D10, 5.7, 5.9)
3. `supabase/migrations/20260928000000_phase1_core.sql`: `join_table`, `place_order`, the `orders_read` and `order_items_read` policies, and the realtime publication on `public.orders`
4. Patterns from Brief 02: `src/lib/menu.ts` (lib layer), `src/lib/errors.ts` (`ActionResult`, `toAppError`), `src/components/ui` (primitives)

## Decision 7, verified locally on 2026-09-29

With `[auth.captcha]` enabled (`provider = "turnstile"`, Cloudflare's always-pass test secret), local Auth answered:

| Endpoint | Without a token | With `XXXX.DUMMY.TOKEN.XXXX` |
|---|---|---|
| Anonymous sign-in (`POST /signup {}`) | 400 `captcha_failed` | 200 |
| Email sign-up | 400 `captcha_failed` | 200 |
| Password sign-in | 400 `captcha_failed` | passes CAPTCHA |
| Password reset (`/recover`) | 400 `captcha_failed` | not tried |
| Email-link verify, token refresh | no CAPTCHA check | n/a |

All five existing e2e tests fail until the staff forms and `e2e/helpers.ts` send a token. So the staff sign-in and sign-up forms get the widget in this brief (task 2). Test keys, from https://developers.cloudflare.com/turnstile/troubleshooting/testing/: site key `1x00000000000000000000AA` (always passes, visible), secret `1x0000000000000000000000000000000AA` (always passes), dummy token `XXXX.DUMMY.TOKEN.XXXX`.

## Design choices this brief fixes (do not relitigate)

- **Anonymous sign-in happens in the browser**, through `src/lib/supabase/client.ts`. From a Server Action, Supabase would see Vercel's IP, and every diner in every restaurant would share one per-IP sign-in limit.
- **The scan URL joins; inner pages re-check.** `GET /t/[token]` is a Route Handler: signed in → `join_table` → a table-scoped cookie (`path=/t/<token>`, httpOnly, SameSite=Lax, Secure in production, 12 hours) holding the session id, table label and restaurant name → 303 to the menu. Not signed in → 303 to `/t/[token]/welcome`. Unknown or inactive token → 303 to `/t/[token]/unavailable`. Inner pages read the cookie and re-read `table_sessions` through RLS on every render (rule A1). A session the diner is not seated in, or one that is closed, shows the closed state with a link to scan again.
- **Orders use the cookie's session id**, so a table closed by staff surfaces `session_closed` instead of silently opening a new tab for a stale phone.
- **Side-effecting GET:** nothing links to `/t/<token>` with a prefetching `<Link>`. Use a plain `<a>` or `window.location.assign`.
- **The pre-sign-in screen cannot show "Casa Grande · Table A4"** (PRD D1): `join_table` needs a signed-in user, and rule 3 forbids an anonymous token lookup. It shows "Getting your table ready…". The name and table appear on the menu header one hop later.
- **The sold-out item is named without changing the RPC.** After `item_unavailable`, re-read the cart's items through the public menu, drop the ones now unavailable, and say "Sorry, Lobster Roll just sold out. We took it off your order." This closes the Brief 02 gated item.
- **No wrapper library for Turnstile** (README). Load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` with `next/script` on the pages that render the widget only.

## Tasks and acceptance criteria

### 1. Database checks (open decision 8)
- New migration (`supabase migration new menu_tag_and_timezone_checks`). First map legacy tags in place (`V` → `vegetarian`, `GF` → `gluten-free`, `VG` → `vegan`, `DF` → `dairy-free`), so the hosted project can apply it. Then add `check (dietary_tags <@ array[...the six values...]::text[])` and a `before insert or update of timezone` trigger on `restaurants` that rejects a zone missing from `pg_timezone_names` with `hint = 'invalid_timezone'`. The trigger function lives in `private`, pins `search_path = ''`, and has execute revoked from `public, anon` (rule 8's hygiene; it is not security definer).
- `src/lib/errors.ts`: `invalid_timezone` in both `DB_HINTS` and `ERROR_COPY`; Settings shows it as a field error on the time zone (Postgres and Node can disagree on zone names).
- pgTAP: an owner cannot store an unknown zone or an unknown tag; a legacy `V` row is mapped (test via a temp row inserted before the check, or assert the seed has no short codes); positive controls. Falsify each.
- **Done when** `npm run db:reset && npm run db:test && npm run db:types` is green and types have no drift.

### 2. Turnstile groundwork and the staff forms
- Invariant 6 (ruled 2026-09-29): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` joins the allow-list in `src/lib/env.ts` and `.env.example`; CI's `.env.local` step writes the test site key.
- `supabase/config.toml`: `[auth.captcha]` as verified above.
- `src/components/ui/Turnstile.tsx`: explicit render, `appearance: "interaction-only"`, callbacks for success, error, expired and timeout. **Condition from Ari:** a failed, blocked or expired widget shows "We couldn't check this device. Try again." with a retry button, never a dead end.
- Staff sign-in and sign-up forms send the token; `src/lib/staff-auth.ts` passes `captchaToken`. `e2e/helpers.ts` sends `gotrue_meta_security.captcha_token` on its Auth API calls.
- **Done when** the five existing e2e tests pass again with CAPTCHA on, and a staff sign-in without a token fails.

### 3. Entry, sign-in and the table session
- `src/app/t/[token]/route.ts` (GET) as in the design choices. `src/lib/diner.ts`: `joinTable(token)`, `getDinerSession(token)`, cookie encode and decode (JSON, validated with zod; a bad cookie counts as no session).
- `/t/[token]/welcome`: light theme, "Getting your table ready…", the Turnstile widget, then `signInAnonymously({ options: { captchaToken } })` in the browser and a full navigation back to `/t/<token>`. States: widget failure (retry), sign-in rate-limited ("We're busy. Try again in a moment." with backoff), network error (retry).
- `/t/[token]/unavailable`: "This table code isn't active. Ask your server for help." (invalid, rotated and deactivated tokens all land here).
- **Done when** a fresh browser scanning a seeded table's link reaches the menu, the session cookie survives the 303 (e2e), and rotated, deactivated and unknown tokens show the unavailable copy.

### 4. Menu (`/t/[token]/menu`, PRD D3 and D4)
- Header: restaurant name · table label, and an "Orders" pill linking to the diner's newest active order in this session.
- Sticky, horizontally scrollable category tabs with scroll-spy (IntersectionObserver; no library). Only active categories, and only items inside them (open decision 11 covers the RPC side).
- Item card: name, two-line description, price via `formatCents`, dietary chips (short text plus a screen-reader label), sold-out items dimmed with a "Sold out" badge and not addable.
- Item sheet (native `<dialog>` as a bottom sheet): full description, tags, a labelled quantity stepper 1 to 50, notes up to 200 characters, "Add · $24.00" updating with quantity.
- Cart bar fixed at the bottom once the cart has items: "3 items · $42.00 · View order". The cart lives in `sessionStorage`, keyed by token and session id, every read and write wrapped in try/catch.
- States: loading skeleton, empty menu ("The menu isn't ready yet. Ask your server."), offline banner, closed session.
- **Done when** a diner can browse, open an item, add two of it with a note, and see the cart bar total, at 390×844 in light and dark.

### 5. Cart and placing the order (`/t/[token]/cart`, PRD D5)
- Lines with stepper, remove and their notes; order notes up to 500 characters; subtotal shown for display only (the database prices the order; rule 4).
- **Place order** → Server Action → `getDinerSession` → zod (1 to 30 lines, uuid ids, quantity 1 to 50, notes up to 200) → `place_order` with the cookie's session id → redirect to the order page and clear the cart. Copy under the button: "Sent straight to the kitchen." (Phase 1 drops the edit sentence.)
- Errors: `item_unavailable` (named, as above), `session_closed` ("This table was closed. Scan the code again to start a new tab."), `rate_limited`, `not_participant`, offline (button disabled with an explanation).
- **Done when** an order lands with the database's prices, an item 86'd while in the cart is named and removed, and a closed session shows the closed copy.

### 6. Order status (`/t/[token]/orders/[orderId]`, PRD D6 Phase 1 part)
- Server render through RLS (a diner reads only their own orders). Timeline Sent → Accepted → Preparing → Ready → Served, or Cancelled with "Your server will follow up". Status copy from PRD 5.7 ("Your order's in. The kitchen has it.", "Accepted. Your food is on its way to being made.", "Ready. It's coming to your table."). Times in the device's time zone (rule A7). "Order more" returns to the menu.
- Live updates: `src/lib/realtime.ts` subscribes to `postgres_changes` on `public.orders` filtered by `id` (rule A5), unsubscribes on unmount, and refetches on reconnect. The realtime client loads on this page only.
- **Done when** an owner's status change (made over REST in e2e) appears on the diner's page without a reload.

### 7. Tests, performance, screenshots, PR
- Vitest: cart logic and storage failure, the sold-out diff, the Turnstile states, the timeline, cookie decode.
- Playwright `e2e/diner-order.spec.ts`: owner setup over the REST API with the owner's JWT (fast); the full diner flow; live status; sold-out naming; unavailable tokens; closed session via `close_table_session` over REST.
- First Load JS for each diner route from `next build`, against PRD 5.9's 150 KB gzip budget. Record the numbers; if over, say by how much and why.
- Screenshots at 390×844, light and dark: welcome, menu, item sheet, cart, order status, unavailable.
- Spec-reconciliation agent; `PM_REVIEW_brief-03.md`; the PR.

## Out of scope

PRD D2 name sheet (Brief 04, where the board shows diner labels) · D6 Edit Order and the add-on cutoff flag (Phase 2) · D7 table requests (Phase 2) · payments (Phase 3) · groups and split (Phase 4) · password reset and PWA (Brief 04) · staff board and closing tables (Brief 04) · open decisions 11 and 12 (Brief 04) · any RPC change.

## Hosted project steps for Ari (in this order)

1. Before this PR's preview can boot: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel. Preview can use the test key `1x00000000000000000000AA`; Production needs a real widget's key.
2. After merge and deploy: create the Turnstile widget in Cloudflare with the production hostname(s), then turn on CAPTCHA (Turnstile, real secret) in Supabase Auth. Not before: the switch is project-wide and would lock out staff sign-in.
3. Apply the new migration to the hosted project.
4. Confirm the hosted anonymous sign-in limit is raised (local is 200 per hour per IP).

## Rules that bite in this brief

Rule 2 (anonymous diners, browser sign-in), rule 3 (no token lookup before `join_table`), rule 4 (no client prices), rule 6 (four browser vars), rule 7 (`getClaims()` on every server path), A1 (re-resolve per render), A5 (realtime filter, unsubscribe, refetch), A8 (Supabase and the realtime client only under `src/lib/`), A9 (dynamic rendering), U1 (thumb-first, 44 px), U4 (status is text), U6 (every state), G3 (falsify every new guard), S1 and S2 (no RPC change, no new dependency).

## Deliverable

One PR to `main`: summary by task, `npm run check` output and the CI link, the falsification record, First Load JS numbers, screenshots, the spec-reconciliation line, `PM_REVIEW_brief-03.md`, and decisions appended to `CLAUDE.md` section 1 in the same PR.
