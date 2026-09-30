# Brief 02: Portal: menu, tables and QR, settings

**Phase:** 1 (walking skeleton) · **Branch:** `phase-1/brief-02-portal` · **Cut from:** `main @ c52c3e2` · **Size:** about 3 to 5 focused sessions

## Objective

Give an owner everything they need before the first diner scans: a menu they can edit and 86 from, tables with printable QR codes they can rotate or deactivate, and the two Phase 1 settings. When this merges, Brief 03 builds the diner flow against a real menu and real QR tokens, and the dashboard checklist's first two items can turn green from the portal alone.

Nothing here changes the schema. Every write goes through the existing RLS policies, column grants and RPCs from `supabase/migrations/20260928000000_phase1_core.sql`. If something in this brief turns out to need a schema change, stop and propose it (rule S1).

## Read first

1. `CLAUDE.md`: section 4 (rules, cited by number below), section 6 (open decisions; 2, 3, 4 and 7 were ruled on 2026-09-29 and shape this brief)
2. This brief, then `docs/phase-1/SCAFFOLD-PLAN.md` for the target tree
3. The PRD, section 5.4: P3 (dashboard), P5 (menu), P6 (tables and QR), P7 (settings). The relevant lines are quoted below so Notion access is not required.
4. The schema's grants (`grant ... on public.menu_categories / menu_items / dining_tables / restaurant_settings / restaurants`) and the RPCs `set_item_availability(p_item_id, p_available)` and `rotate_table_qr(p_table_id)`. These define what the portal can do; the UI never asks for more.
5. The existing patterns: `src/app/restaurant/onboarding/actions.ts` (Server Action shape), `src/lib/restaurants.ts` (lib layer), `src/lib/errors.ts` (`FormResult`, `ActionResult`, `toAppError`), `src/lib/validation/restaurant.ts` (zod schemas)

## What the database already allows (do not widen; rule 5, rule S1)

| Surface | Owner / manager | Floor staff (`role = staff`) | Diner / signed-out |
|---|---|---|---|
| `menu_categories` | insert, update (`name`, `sort_order`, `is_active`), delete | read | read active only |
| `menu_items` | insert, update (`category_id`, `name`, `description`, `price_cents`, `is_available`, `image_path`, `dietary_tags`, `sort_order`), delete | read; 86 via `set_item_availability()` only | read (sold-out included) |
| `dining_tables` | insert (`label`, `capacity`, `is_active`), update (`label`, `capacity`, `is_active`), rotate via `rotate_table_qr()`; delete is granted but **not used** (rule 5) | read | **none** (rule 3) |
| `restaurants` | update (`name`, `timezone`, `currency`) | read | read |
| `restaurant_settings` | update (`order_edit_window_mins` 0 to 30, `order_addition_cutoff_mins` 0 to 240) | read | none |

`qr_token` is set by a trigger and never by a client. `menu_items.category_id` is `on delete set null`, so deleting a category orphans its items rather than deleting them. `order_items.menu_item_id` is `on delete set null` and the row keeps its name and price snapshot, so deleting a menu item does not touch order history.

## Tasks and acceptance criteria

### 1. Groundwork
- Add the `server-only` package (ruled 2026-09-29, open decision 4). Import it at the top of `src/lib/supabase/server.ts`, `src/lib/auth.ts`, `src/lib/staff-auth.ts`, `src/lib/restaurants.ts` and every new server lib module. Not `src/lib/env.ts` (the browser Supabase client imports it) and not `src/lib/supabase/proxy.ts` (proxy runtime). Pure helpers that tests or client forms import (validation, price parsing, `canManage`, the dietary-tag vocabulary) stay in modules without it, because `server-only` throws under Vitest. It is the one new dependency in this brief; ask before any other (rule S2).
- Create the lib modules (rule A8): `src/lib/menu.ts` (categories and items), `src/lib/tables.ts`, `src/lib/settings.ts`. Each function takes a user-scoped server client, returns `ActionResult<T>` or throws on unexpected read errors, and never imports anything from `src/app`.
- Create `src/lib/validation/menu.ts`, `tables.ts`, `settings.ts` with zod schemas that mirror the DB checks exactly (lengths, ranges, patterns). Price input is a dollars string (`"12.50"`) parsed with a regex and integer arithmetic into `price_cents`; never `parseFloat` (rule A6). Timezone must be in `Intl.supportedValuesOf("timeZone")`.
- Add a `role` gate helper in `src/lib/roles.ts` (no `server-only`): `canManage(role)` returns true for `owner` and `manager`. It is UI convenience only; RLS is the boundary (rule 7). Floor staff see the pages read-only, with the 86 toggle live.
- `PortalNav`: Menu, Tables and Settings become `ready: true`. Orders stays "soon".
- Dashboard checklist: "Add menu items" links to `/restaurant/menu`, "Add tables and print QR codes" links to `/restaurant/tables`. "Place a test order" keeps "Available once the diner flow ships."
- **Done when** `npm run check` passes, a client component that imports a `server-only` module fails `next build` (try it once, then revert), and the nav shows the three new pages.

### 2. Menu: categories (`/restaurant/menu`)
PRD P5: "Categories (add, rename, reorder, hide)."
- List categories in `sort_order`, each with its item count and an active/hidden badge (text plus color, rule U4). Hidden categories are dimmed, not removed.
- Add (name), rename inline, hide/show (`is_active`), move up/down (swap `sort_order` with the neighbour; buttons, not drag, for keyboard and screen-reader users). Every control is at least 44×44px (rule U1 applies to the portal too).
- Delete only when the category has zero items. Otherwise the button is disabled with the hint "Move or delete its items first." Deleting a category with items would silently orphan them (`on delete set null`), and an orphaned item never shows on the diner menu.
- Server Actions in `src/app/restaurant/(portal)/menu/actions.ts`, one per mutation, each `requireMembership()` then zod then lib call (rule A4, rule 9). Return `FormResult` for forms and `ActionResult` for buttons. Call `revalidatePath("/restaurant/menu")` after every write.
- **Done when** an owner can add, rename, reorder, hide and delete an empty category; a floor-staff session sees the list with no write controls; and a direct call to the category insert as floor staff is denied by RLS (covered in task 7).

### 3. Menu: items and 86 toggle (`/restaurant/menu`)
PRD P5: "items (name, description, price, category, dietary tags, availability). 86 toggle inline on each row, usable by any staff role."
- Items grouped under their category, uncategorised items in an "No category" group at the end with a hint to assign one.
- Add and edit in a form (route `/restaurant/menu/items/new` and `/restaurant/menu/items/[itemId]`): name (1 to 120), description (up to 500), price in dollars (0 to 10,000.00, stored as cents), category (select, active categories only), dietary tags (checkbox chips from a fixed vocabulary: `vegetarian`, `vegan`, `gluten-free`, `dairy-free`, `contains-nuts`, `spicy`; rendered as short text chips like "V", "GF"), availability. Prices render through `formatCents()` only (rule A6). No image upload (PRD: images are Phase 2; leave `image_path` null).
- **86 toggle** on every row, inline, no page change: a labelled switch ("Available" / "Sold out") that calls `set_item_availability()` through `src/lib/menu.ts`. It works for every role. Optimistic UI is fine, but the row re-reads after the action resolves. Never update `is_available` through a direct table update from the toggle, because floor staff have no update grant; the RPC is the path (rule 5).
- Reorder within a category with up/down buttons (`sort_order`).
- Delete with a confirmation dialog rendered in-page (never `window.confirm`): "Delete Lobster Roll? Past orders keep their copy." Deleting is owner/manager-only.
- Empty state when there are no categories: "Start with a category, then add items to it." with a button to add one.
- **Done when** an owner can create an item at `$12.50` and the DB row holds `1250`; the seed's sold-out item shows "Sold out" and the toggle flips it; a floor-staff session can flip the toggle but sees no edit, add or delete controls; and a price update as floor staff is denied by RLS (already covered by pgTAP "floor staff cannot change prices").

### 4. Tables (`/restaurant/tables`)
PRD P6: "Add table (label, capacity), activate/deactivate. Rotate QR with confirmation ("Printed codes for A4 will stop working")."
- List tables: label, capacity, active badge, and the diner link `/t/<token>` shown truncated with a copy button (owner/manager only; floor staff see label and status only, since they do not need tokens on screen even though RLS lets members read them).
- Add (label 1 to 40, unique per restaurant; capacity 1 to 100, optional). A duplicate label maps to "You already have a table called A4." (unique violation on `(restaurant_id, label)`; extend `toAppError` only if the existing `23505` mapping to `slug_taken` gets in the way, and keep the copy per context).
- Edit label and capacity inline. Deactivate and reactivate (`is_active`). **No delete control anywhere** (rule 5). A deactivated table's QR resolves to "This table code isn't active" in Brief 03.
- **Rotate QR:** button opens an in-page confirmation: "Printed codes for A4 will stop working. You'll need to print a new one." Confirm calls `rotate_table_qr()` through `src/lib/tables.ts`, then the list shows the new link and a toast: "New code ready. Print it from the sheet."
- **Done when** an owner can add, edit, deactivate, reactivate and rotate; the token changes on rotate and the old one is gone from the list; the seed's four tables render; and floor staff can insert a table only by hitting an RLS denial (task 7).

### 5. QR print sheet (`/restaurant/tables/print`)
PRD P6: "one card per table: QR (high error correction, at least 3 cm printed), table label, 'Scan to order' (Phase 1 copy), restaurant name. PDF/print-friendly layout, 4 or 6 per page."
- Server-rendered page, active tables only, 6 cards per Letter/A4 page (CSS `@page`, `break-inside: avoid`). Each card: QR as inline SVG from `qrcode` (`errorCorrectionLevel: "H"`, quiet zone kept), sized so the printed module block is at least 3 cm at 100% scale (about 35 mm rendered), the label large, "Scan to order", and the restaurant name. The encoded URL is `${NEXT_PUBLIC_SITE_URL}/t/${qr_token}` (invariant 6 lists this var as browser-safe; it is read on the server here anyway through `src/lib/env.ts`).
- The page is light-themed for printing regardless of the portal's dark shell (a `data-theme="light"` wrapper), with a "Print" button that calls `window.print()` and is hidden in print media.
- Owner/manager only; floor staff get a 404-style "Nothing here" rather than a token dump. Render dynamically (rule A9): tokens are per-restaurant secrets.
- QR generation stays server-side, so `qrcode` is imported only under `src/lib/` (`src/lib/qr.ts`), not in components (rule A8 is about Supabase, but the same seam keeps the print page a pure Server Component).
- **Done when** a printed test page (Chrome print preview, "Save as PDF") shows 6 cards per page with scannable codes, a phone camera scanning the on-screen code decodes to `<NEXT_PUBLIC_SITE_URL>/t/<token>` (the route itself 404s until Brief 03; on the Vercel preview the URL is reachable), and the rotated table's old code is no longer on the sheet.

### 6. Settings (`/restaurant/settings`)
PRD P7 (Phase 1): "order edit window (0 to 30 min, default 5), add-on cutoff (stored; enforced in Phase 2)." Plus, ruled 2026-09-29 (open decision 3): restaurant timezone lives here.
- One page, three groups, one Server Action per group:
  - **Restaurant:** name (1 to 120), timezone (a plain `<select>` built from `Intl.supportedValuesOf("timeZone")`, grouped by region prefix, default `America/New_York`; no picker component). Slug is shown read-only with the note "Changing your link would break printed codes" (slug changes are out of scope; the diner URL uses the token, not the slug, but keep it fixed for now). Currency stays `usd`, read-only, until payments.
  - **Orders:** edit window (number input, 0 to 30, helper: "How long a diner can change an order after sending it. 0 turns editing off."), add-on cutoff (0 to 240, helper: "Stored now. Enforced when late add-ons ship in Phase 2.").
- Owner/manager only. Floor staff see the values read-only.
- Timezone rendering (rule A7): the portal header or dashboard shows the current time in the restaurant's timezone as a sanity check ("Kitchen time 7:42 pm").
- **Done when** an owner changes the edit window to 10 and a pgTAP-style check of `restaurant_settings` shows 10; a value of 31 is rejected by zod with a field error and, if forced past zod, by the DB check; timezone changes persist and the header clock moves; and floor staff cannot update settings (task 7).

### 7. Tests, e2e, screenshots, PR
- **pgTAP** (`supabase/tests/database/phase1_security.test.sql` or a new `phase1_portal.test.sql`): add negative tests for the writes this brief's UI depends on that are not yet covered: floor staff cannot insert a category, cannot insert a table, cannot update `restaurant_settings`, cannot update `restaurants.name`; owner cannot set `order_edit_window_mins` to 31 (check constraint); owner cannot delete a table that has a session (already covered as "a table with order history cannot be deleted"; leave it). Every new test gets a falsification probe (rule G3) recorded in the PR.
- **Vitest:** validation schemas (price string to cents edge cases: `"12"`, `"12.5"`, `"12.50"`, `"0"`, `"12.555"` rejected, `"1e3"` rejected, `"10000.01"` rejected), `canManage`, the dietary tag vocabulary, and a render test per new component (toggle, confirmation dialog).
- **Playwright** `e2e/portal-setup.spec.ts`: create a confirmed owner with `createConfirmedStaff`, onboard, add a category and an item at `$12.50`, flip the 86 toggle and see "Sold out", add table `A4`, open the print sheet and assert one card with the label, rotate `A4` and assert the link changed, set the edit window to 10 and reload to see it. Keep `e2e/staff-onboarding.spec.ts` green.
- **Screenshots** at 1024×768 (menu, item form, tables, print preview, settings) and 390×844 for menu and tables (owners will do this from a phone). Save under `docs/phase-1/screenshots/brief-02/`.
- Run the spec-reconciliation agent; put its summary line in the PR.
- **Done when** CI is green on the PR and the PR follows the Deliverable below.

## Out of scope (later briefs)

Diner `/t/[token]` flow, Turnstile, cart, `place_order` (Brief 03) · realtime order board, close table (Brief 04) · item images, modifiers, scheduled availability, staff invites and roles UI, ticket-age thresholds, "staff opens table" mode (Phase 2) · payments, tip presets, tax (Phase 3) · slug changes · any table delete · any schema change.

## Rules that bite in this brief

- Rule 5: no table deletes, no widened grants, 86 through the RPC only.
- Rule 7 and rule 9: `requireMembership()` and zod in every action; the UI role gate is convenience.
- Rule A6: cents everywhere, `formatCents()` for display, no floats in parsing.
- Rule A8: `@supabase/*` and `qrcode` imports stay under `src/lib/`.
- Rule A9: every portal page renders dynamically.
- Rule U4: badges and the 86 state carry text, not only color; the confirmation dialogs trap focus and close on Escape.
- Rule G3: falsify every new pgTAP test once.
- Rule S1 and S2: any schema change or dependency beyond `server-only` stops for Ari.

## Deliverable

One PR to `main` containing:
- a summary of what was built, mapped to the numbered tasks above
- `npm run check` output and the CI link
- the falsification record for the new pgTAP tests
- screenshots listed in task 7
- the spec-reconciliation summary line
- decisions made, appended to `CLAUDE.md` section 1 in the same PR (not `docs/DECISIONS.md`)
- anything you'd change in the schema, as a proposal only, not applied

## Kickoff prompt (paste into Claude Code)

> Read `CLAUDE.md` (sections 4, 6 and 8), then `docs/phase-1/BRIEF-02-portal.md`. Confirm you are on `phase-1/brief-02-portal` cut from `main @ c52c3e2`. Plan the work as a checklist mapped to Brief 02's seven tasks and show me the plan before writing code. Then execute task by task: run `npm run check` after each task, commit with a conventional message, and stop to ask me before anything in section 4 "When to stop and ask Ari". Work against local Supabase only. When all seven tasks meet their "done when" criteria, open the PR described under Deliverable and stop.
