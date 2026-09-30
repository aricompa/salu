# PM review: Brief 02 (portal: menu, tables and QR, settings)

**Tracked:** yes, committed on the branch with PR #3. When Ari rules, add a status banner under this title; don't edit the body.

## 1. Header

- **Date:** 2026-09-29
- **Branch:** `phase-1/brief-02-portal`, PR #3 (https://github.com/aricompa/salu/pull/3). This file ships in the head commit; its parent is `272ffff`, which CI passed (run 36652101090: `check`, `secrets`, Vercel preview).
- **Worktree:** `/Users/ari/salu`. **Committed:** yes, nothing uncommitted.
- **Desk (2026-09-29, re-run while writing this file):**

| Check | Result |
|---|---|
| Vitest | 134/134, 18 files |
| pgTAP | 68/68 (43 security + 25 portal) |
| Playwright, production build | 5/5 |
| `supabase db lint` | no errors |
| Prettier | clean |
| `next build` | all 8 `/restaurant/*` routes dynamic |

- **Gate:** `DESK-GREEN`. Not `PM-ACCEPTED`: the acceptance run in section 5 is Ari's.

## 2. Bottom line

The portal now lets an owner or manager build a menu, 86 items, add tables, print QR cards, rotate or deactivate codes, and set the order timers and time zone, with no schema change and every write going through the existing policies and RPCs. Floor staff can 86 items and see everything else read-only. What limits what this is worth today: the database still accepts any time zone and any dietary tag (invariant 9 is half met, open decision 8), no printed card has been scanned by a phone, and the floor-staff views are proven by render tests and pgTAP only, not by a signed-in browser.

## 3. Scope

**Built:** all seven Brief 02 tasks, plus an offline banner (rule U6), a kitchen clock in the restaurant's time zone (rule A7), and four new UI primitives (Select, Textarea, ActionButton, ConfirmDialog). One new dependency: `server-only`, as ruled.

**Deliberately not built:** table delete (rule 5), item images, modifiers, slug changes, staff invites, toasts, any schema change, anything diner-facing.

## 4. Findings the PM must see before accepting

1. **Invariant 9 is half met.** zod checks the time zone and dietary tags; the database does not. A bad time zone written straight through the API used to crash every portal page; that crash is fixed, but the database check needs a migration (open decision 8, proposal in PR #3).
2. **The seed had a real bug.** `seed.sql` stored dietary tags as `V` and `GF`, so saving any seeded item in the new form would have silently erased its tags. Fixed, with a drift test. If the hosted project was seeded with the old values, it needs the same data fix.
3. **Floor staff are never signed in end to end.** Phase 1 has no invite flow, so their views are covered by role-prop render tests and 12 pgTAP tests only.
4. **No printed card has been scanned by a phone.** Chromium decoded 7 of 7 codes on screen, and a 7-table sheet prints as 2 pages on Letter and A4.
5. **One unexplained unit-test failure.** `npm run check` failed one test once, right after a database reset. Nine runs since passed, including one during a reset. My output filter dropped the test's name, so I can't say which test it was. If it recurs, capture the full Vitest output.
6. **The seed's Demo Bistro was never exercised in the UI.** The seed has no user who can sign in to it; every UI test uses a freshly onboarded restaurant.
7. **The pre-commit hook warns "hard delete" on `src/lib/menu.ts`.** Those are deletes of empty categories and of menu items. Rule 5 covers orders, sessions and tables, and no table has a delete path.

**Corrections of earlier claims:**
- I wrote in Brief 02 that `src/lib/env.ts` gets `server-only`. That was wrong: the browser Supabase client imports it. It is unmarked, and the correction is logged in `CLAUDE.md` section 1.
- I wrote the settings note "Changing your link would break printed codes." That was wrong: the QR carries the table token, not the slug. The page says "set at sign-up, can't be changed yet."
- I wrote that the 86 switch's label flips between "Available" and "Sold out". It doesn't: its name stays "Available <item>", and the state shows through the switch and the row's "Sold out" badge (builder call (h)).
- I wrote that the item form lists active categories only. It lists hidden ones too, marked "(hidden)" (builder call (g)).
- I wrote that the time zone must be in `Intl.supportedValuesOf`. It accepts any zone the runtime can format, including aliases such as `UTC` (builder call (l)).
- I wrote that every new test gets a falsification probe. Seven of the 25 new pgTAP tests were failed directly by a probe, plus the `server-only` marker, the seed drift test and the row-count guard. The other 18 were not probed.
- The handoff checklist promised one commit per task. The branch has four task commits: tasks 2 and 3, and 4 and 5, share pages.

## 5. Acceptance surface

Commands 1 to 5 were re-run while writing this file; expected outcomes in brackets.

1. `git checkout phase-1/brief-02-portal && npm install`
2. `npm run db:start && npm run db:reset` [Reset local database.]
3. `npm run check` [Tests 134 passed (134) · Files=2, Tests=68 · Result: PASS]
4. `npm run build` [Compiled successfully · 8 `/restaurant/*` routes marked ƒ]
5. `CI=1 npx playwright test` [5 passed]
6. **Ari, by hand, on the Vercel preview for PR #3** (the e2e above covers the same path on a local build):
   - Sign up, confirm the email, and onboard. [Dashboard, 0 of 3 done]
   - Menu: add a category "Mains", then an item at 12.50. [Menu shows $12.50]
   - Flip the item's switch. [A "Sold out" badge appears and survives a reload]
   - Tables: add A4. [Active badge, a shortened `/t/…` link]
   - Print QR codes, printed at 100%. [One card: restaurant name, QR, "A4", "Scan to order"]
   - Scan the printed card with a phone. [It opens `<preview>/t/<token>`. The page 404s until Brief 03; the URL is what matters]
   - Rotate QR on A4. [Dialog: "Printed codes for A4 will stop working." Then "New code ready." and a different link]
   - Settings: set the edit window to 31. [Field error]
   - Set it to 10. [Saved; it persists on reload]

## 6. Falsification record

Each guard was broken on purpose, the listed tests failed, and the guard was restored. Database probes were restored with `supabase db reset`, which returned 68/68. File probes were restored byte-identical.

| Guard broken | Tests that failed |
|---|---|
| `settings_manager_update` widened to any member | pgTAP portal 5 |
| edit-window check constraint dropped | pgTAP portal 11 |
| `tables_manager_insert` widened to any member | pgTAP portal 3, 10 |
| `rotate_table_qr` without its membership check | pgTAP portal 9, 21 |
| `order_items.menu_item_id` changed to `on delete cascade` | pgTAP portal 25 |
| `server-only` marker removed from `src/lib/mutations.ts` with a client importer | `next build` stopped failing (marker present: "'server-only' cannot be imported from a Client Component module") |
| one seed tag set back to `V` | Vitest seed drift guard |
| 0 changed rows reported as success in `oneRowChanged` | Vitest "treats 0 rows as not allowed" |

The existing 43 security tests stayed green under the settings and `rotate_table_qr` probes. The new file closes those gaps.

## 7. PM items

1. **Open decision 8, a schema change (rule S1).** Recommendation: add the tag check and the time zone trigger as the first migration of Brief 03.
2. **Open decision 10, a source conflict.** PRD 5.10 grants "CRUD" on tables. Recommendation: amend it to "create, edit, deactivate, rotate QR".
3. **Open decision 9.** Recommendation: keep item delete for Phase 1.
4. **Builder calls (a) to (m)** in `CLAUDE.md` section 1, all pending your review. Rule on any you want changed.
5. **Hosted seed data:** replace `V` and `GF` tags if present. Not touched from here (rule 10).
6. **Acceptance run** in section 5, step 6, including the phone scan of a printed card.

## 8. Raw desk tail (2026-09-29)

The first `npm run check` below is the unexplained failure in finding 5. Nine later runs passed.

```
$ npm run db:reset
{"target":"local","version":"","message":"Reset local database."}
$ npm run check
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 133 passed (134)
$ npm run format:check
All matched files use Prettier code style!
$ npx supabase db lint --level warning --fail-on error
Connecting to local database...
$ npm run build
✓ Compiled successfully in 749ms
├ ƒ /restaurant/dashboard
├ ƒ /restaurant/menu
├ ƒ /restaurant/menu/items/[itemId]
├ ƒ /restaurant/menu/items/new
├ ƒ /restaurant/onboarding
├ ƒ /restaurant/settings
├ ƒ /restaurant/tables
└ ƒ /restaurant/tables/print
$ CI=1 npx playwright test
  ✓  1 [chromium] › e2e/staff-onboarding.spec.ts:10:5 › owner signs up, confirms email, creates a restaurant and sees the dashboard (1.4s)
  ✓  3 [chromium] › e2e/staff-onboarding.spec.ts:55:5 › an anonymous diner session cannot open the staff portal (657ms)
  ✓  2 [chromium] › e2e/portal-setup.spec.ts:31:5 › owner builds a menu: categories, items in cents, the 86 toggle (2.8s)
  ✓  4 [chromium] › e2e/portal-setup.spec.ts:112:5 › owner adds tables, rotates a QR code and prints the sheet (1.8s)
  ✓  5 [chromium] › e2e/portal-setup.spec.ts:169:5 › owner changes order timers and the time zone (2.3s)
  5 passed (7.7s)
$ npm run db:test
/Users/ari/salu/supabase/tests/database/phase1_portal.test.sql .... ok
/Users/ari/salu/supabase/tests/database/phase1_security.test.sql .. ok
Files=2, Tests=68,  0 wallclock secs ( 0.01 usr +  0.01 sys =  0.02 CPU)
Result: PASS
$ npx supabase db lint --level warning --fail-on error
Linting schema: extensions
Linting schema: private
Linting schema: public

No schema errors found
{"results":[],"message":"db lint"}
$ npx vitest run src/lib/mutations.test.ts src/lib/validation/menu.test.ts
 Test Files  2 passed (2)
      Tests  39 passed (39)
```
