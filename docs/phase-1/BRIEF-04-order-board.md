# Brief 04: Live order board and Phase 1 exit

**Phase:** 1 (walking skeleton) · **Branch:** `phase-1/brief-04-order-board` · **Cut from:** `main @ e491a8f` · **Size:** about 5 to 7 focused sessions

## Objective

Staff run service from a live order board: new orders appear within seconds with an alert, move through accepted, preparing, ready and served, can be cancelled, and tables are seated and closed from the board. A table takes orders only after staff seat it, so a photographed code is useless from home (ruled 2026-09-30). Diners get a name on their orders. Then Phase 1 exits: a "fake dinner" with two or more phones, on the hosted project, on iPhone Safari.

The tasks are ordered so the exit path comes first. Password reset and the PWA manifest (ruled into this brief on 2026-09-29) come after it.

## Read first

1. `CLAUDE.md`: section 4 (rules), section 1's 2026-09-29 and 2026-09-30 entries (Realtime needs the JWT before joining and "live" means the change feed is ready; a new public env var reaches Production only with its merge; check hosted Auth settings before a phone test), section 6 (open decisions 11, 12, 13)
2. The PRD: P3 (dashboard), P4 (orders board), D2 (name sheet), D10 (session ended by staff), P1 (password reset), 5.5 (state machine), 5.9 (performance)
3. `supabase/migrations/20260928000000_phase1_core.sql`: `enforce_order_transition`, `close_table_session`, `orders_member_update`, `participants_read`, `participants_self_update`, the realtime publication (`orders` only)
4. Brief 03's `src/lib/realtime.ts` (the two Realtime fixes) and `src/components/diner/OrderStatusView.tsx` (lazy realtime, refetch on live)

## What the database already allows (no change needed for tasks 1 to 6)

| Action | Who | Path |
|---|---|---|
| Move an order along or cancel it | any member, including floor staff | `update orders set status` (column grant); the trigger enforces `submitted → accepted → preparing → ready → served`, `accepted → ready`, and cancel from submitted, accepted or preparing, and stamps `accepted_at`, `ready_at`, `served_at`, `cancelled_at` |
| Close a table | any member | `close_table_session(p_session_id)` |
| Read diner names | staff of the restaurant; the diner themselves | `session_participants` (`participants_read`) |
| Set one's own name | the diner | `join_table(p_qr_token, p_display_name)` or `update session_participants set display_name` (`participants_self_update`) |

`orders.placed_by` has no foreign key to `session_participants`, so labels come from a second query, not a PostgREST embed.

## Design choices this brief fixes

- **Realtime is a trigger, not a data source.** The board is a Server Component. A client listener subscribes to `postgres_changes` on `public.orders` filtered by `restaurant_id` (rule A5) and, on any event, asks the server to re-render (`router.refresh()`). `order_items` isn't in the publication and `place_order` inserts, then updates the subtotal, so a payload is never the full picture; a re-render always is, and reconnect is correct by construction.
- **Coalesce refreshes:** one trailing refresh, at most one in flight. A single order produces an INSERT then an UPDATE; a status action already revalidates; a busy service sends bursts.
- **Reuse both Brief 03 Realtime fixes:** `await realtime.setAuth()` before subscribing; "Live" and a refetch happen on the `postgres_changes` system message, not the join reply.
- **New-order alerts compare order ids between renders,** never event payloads. Ids present on first mount don't alert; orders that arrived during a disconnect still alert after reconnect. Sound is a WebAudio tone (no audio file), unlocked by one tap ("Turn on sound", browser autoplay rules), and the choice is remembered in `localStorage` wrapped in try/catch.
- **A long service must survive token refresh.** Access tokens expire hourly; realtime-js closes a channel at expiry when its token isn't refreshed. The board must keep receiving events across a refresh (task 5 proves it).
- **"Done today" is computed in the restaurant's time zone** (rule A7).
- **No new public env vars.** If one becomes unavoidable, it goes to Vercel Preview first and to Production only with its merge (2026-09-29 rule).
- **The scan URL is never a prefetching `<Link>`**, including the dashboard's "place a test order" link.

## Tasks and acceptance criteria

### 1. Orders board (`/restaurant/orders`, PRD P4)
- Columns New · Accepted · Preparing · Ready. Served and Cancelled collapse into a "Done today" drawer.
- Card: table label (large), diner label, age timer ("6 min"; warning at 10 minutes, danger at 20, each with text as well as colour, rule U4), item lines with quantities and notes (notes highlighted), order notes, the primary action for the next state, and Cancel behind a confirmation ("Cancel A4's order? The diner sees it was cancelled.").
- Status changes are Server Actions (rule A4) that update `status` only (rule 5), map `invalid_transition` to its copy ("That order already moved on. Refresh to see where it is."), and read back the changed row.
- Live indicator: "Live" / "Reconnecting…". New-order alert: sound toggle plus a pulse on the new card (none under reduced motion).
- Floor staff see and use the whole board (they may move orders along); the Orders nav item turns on.
- **Done when** a second browser's order appears on the board without a reload, each action moves it one column, a cancel asks first, and a stale action shows the invalid-transition copy.

### 2. Seat and close tables (prank protection, ruled 2026-09-30)
- **Migration (rule S1, ruled):** `restaurant_settings.require_staff_open boolean not null default true` with an update grant for owners and managers; `public.open_table_session(p_table_id)` (security definer, pinned `search_path`, any member of the table's restaurant, active tables only, get-or-create the open session, returns its id; execute revoked from `public, anon`); `join_table` refuses a table with no open session while the setting is on (`hint = 'table_not_open'`) and otherwise behaves as today.
- **pgTAP:** a diner can't join an unseated table while the setting is on, and can after staff seat it; floor staff can seat; another restaurant's owner can't; an anonymous user can't call `open_table_session`; with the setting off, joining opens a session as before; a closed table must be seated again. Falsify each guard. The older test files seat their tables in their fixtures, with no assertion changed.
- **Board:** a "Tables" strip lists every active table: seated ones show their unserved-order count and "Close table" behind a confirmation that names the count ("A4 still has 2 open orders. Close anyway?"); unseated ones show "Seat". Both are Server Actions.
- **Diner:** the scan route sends `table_not_open` to `/t/[token]/not-seated`: "Your table isn't open yet. Ask your server to seat you, then scan again", with a plain `<a>` back to the scan URL. A closed table is learned on the next page load or order attempt (PRD D10 ruling, 2026-09-30).
- **Settings:** a toggle "Staff seat tables before diners can order" (owners and managers).
- e2e fixtures seat tables through the RPC.
- **Done when** an unseated table's code shows the not-seated copy, seating lets the same phone order, closing makes the next order attempt answer `session_closed`, and a rescan after closing shows not-seated again.

### 3. Diner names (PRD D2)
- A one-field bottom sheet over the menu the first time in a session: "What should we call you?" (up to 40 characters) with **Skip** equally prominent. Saves through `participants_self_update` via `src/lib/`.
- Board label: the display name, or "Guest N", where N is the diner's position by `joined_at` in that session.
- **Done when** a named diner's order shows the name on the board, and a skipped one shows "Guest 1".

### 4. Dashboard live counts (PRD P3)
- Once live: open tables, orders waiting (submitted), and average ticket age today.
- The checklist's "Place a test order" becomes a plain `<a>` to the first active table's scan URL (owners and managers only).

### 5. End-to-end and latency (Phase 1 exit, desk half)
- `e2e/order-board.spec.ts`, two browsers: a diner scans, names themselves and orders; the board shows it with the name; staff accept, then mark it ready; the diner's status page follows live.
- **Long-service probe:** temporarily shorten `jwt_expiry` in `supabase/config.toml`, prove the board still receives events after a token refresh, then restore the file byte-identical. Never push this config.
- **Latency:** 20 orders against a local production build; p95 from `place_order` returning to the card on the board. Recorded as desk evidence only; the exit criterion is about the hosted system.

### 6. Toast primitive
- `src/components/ui/Toast.tsx`: `role="status"`, auto-dismiss, reduced-motion aware. Used for board actions and for Brief 02's QR-rotation confirmation (builder call (i)).

### 7. Staff auth in the browser (open decision 12, ruled 2026-09-30) and password reset (PRD P1)
- Sign-in, sign-up and reset call Supabase Auth from the browser client under `src/lib/`; zod gives form feedback; redirects stay same-origin (`safeNextPath`) and refresh server state. The existing e2e and the no-token refusal test stay green.
- "Forgot password?" on `/login` → email plus Turnstile → `resetPasswordForEmail` with the CAPTCHA token (Auth requires it on `/recover`, verified 2026-09-29). Always answer "If an account exists for that email, we sent a link", so the form doesn't reveal accounts.
- Local `supabase/templates/recovery.html` (token_hash), wired in `config.toml`; the hosted template is Ari's step. `/auth/confirm` handles `type=recovery` and lands on a new-password page that requires a non-anonymous session (checked with `getClaims()`).

### 8. PWA manifest and icons
- `src/app/manifest.ts`, `src/app/icon.tsx` and `src/app/apple-icon.tsx` (built-in `ImageResponse` from `next/og`; no dependency). The pre-commit hook blocks hex in `src/`, and the brand colour is open (decision 1), so colours use `rgb()`; logged as a rule U3 exception.

### 9. Open decision 11 (ruled in 2026-09-30)
- A new migration redefines `place_order` to also require the item's category to be active, with pgTAP negatives and falsification.

### 10. Phase 1 exit checklist and PR
- `PM_REVIEW_brief-04.md` includes the README's exit criteria with who verifies each: desk (Claude Code), hosted (Ari: Supabase security advisor 0 errors, hosted Auth settings), on-device (Ari: iPhone Safari, the fake dinner with two or more phones, menu interactive in under 3 s on restaurant Wi-Fi, board within 2 s p95).
- Before any phone test: the read-only check of hosted Auth settings (`/auth/v1/settings`: anonymous sign-ins on).
- Screenshots at 1024×768 (board, drawer, open tables) and 390×844 (name sheet). Spec-reconciliation agent. PR.

## Rulings (all given 2026-09-30)

1. Open decision 11: yes, task 9.
2. Open decision 12: staff auth moves to the browser, task 7.
3. PRD D10: no live closure; the diner learns it on the next action.
4. Prank protection: staff seat tables, on by default, task 2.

## Out of scope

Table view toggle, late add-on badges, table requests, staff invites and roles UI, ticket-age thresholds as settings (Phase 2) · live table closure for diners (ruled out 2026-09-30) · payments (Phase 3) · groups and split (Phase 4) · open decision 13's caching (measure only) · brand colour (decision 1).

## Rules that bite in this brief

Rule 5 (status only; no deletes), rule 7 (`getClaims()`), A4, A5 (filter, unsubscribe, refetch), A7 (restaurant time zone), A8, A9, U1 (tablet and phone targets), U2 (portal dark, readable at arm's length: board cards 18 px and up), U4 (timers and statuses carry text), U6 (every state, including "Reconnecting…"), G3 (falsify every new guard), S1 and S2.

## Deliverable

One PR to `main`: summary by task, `npm run check` and the CI link, the long-service probe and latency numbers, the falsification record, screenshots, the spec-reconciliation line, `PM_REVIEW_brief-04.md` with the exit checklist, and decisions appended to `CLAUDE.md` section 1.
