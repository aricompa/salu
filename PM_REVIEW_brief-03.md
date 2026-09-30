# PM review: Brief 03 (diner flow)

**Tracked:** yes, committed on the Brief 03 branch with its PR. When Ari rules, add a status banner under this title; don't edit the body.

## 1. Header

- **Date:** 2026-09-29
- **Branch:** `phase-1/brief-03-diner`, cut from `main @ 19159cb`. This file ships in the commit that opens the PR; its code parent is `8e3e7d4`.
- **Worktree:** `/Users/ari/salu`. **Committed:** yes, nothing uncommitted.
- **Desk (2026-09-29, re-run on a fresh `db:reset` while writing this file):**

| Check | Result |
|---|---|
| Vitest | 161/161, 22 files |
| pgTAP | 78/78 (43 security + 25 portal + 10 checks) |
| Playwright, production build | 13/13 |
| `supabase db lint` | no errors |
| gitleaks (git history) | no leaks |
| `next build` | all six `/t/[token]` routes dynamic |
| First-load JS (gzip) | welcome 141 KB, menu 147 KB, cart 146 KB, order 144 KB |

- **Gate:** `DESK-GREEN`. Not `PM-ACCEPTED`: that needs your hosted steps (section 7) and the acceptance run (section 5).

## 2. Bottom line

A diner can now scan a table code, pass an invisible device check, sign in anonymously, order from the menu, and watch the status change live, with the database pricing every order and RLS deciding what each diner can see, including over Realtime. What limits what this is worth today: none of it has run on a real phone or on the hosted project yet. Turnstile has only met Cloudflare's always-pass test keys. The preview needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set in Vercel before it can boot, and hosted CAPTCHA must stay off until after the deploy.

## 3. Scope

**Built:** all seven Brief 03 tasks:
- the database checks from open decision 8
- Turnstile on staff sign-in and sign-up
- the scan route and anonymous table session
- the menu, the cart and placing orders
- live order status
- tests, performance work and screenshots

It also adds offline banners and loading states on every diner page, and a scrim token for the bottom sheet. No new dependency. No RPC change beyond the ruled migration.

**Deliberately not built:**
- the diner name sheet (PRD D2, Brief 04)
- Edit Order (Phase 2)
- table requests (Phase 2)
- payments
- the staff board and closing tables (Brief 04)
- open decisions 11, 12 and 13
- password reset and PWA (Brief 04)

## 4. Findings the PM must see before accepting

1. **Hosted order of operations matters.**
   - Set the site key in Vercel first, or the preview crashes at boot.
   - Enable CAPTCHA in Supabase only after the deploy. The switch is project-wide and would lock out staff sign-in.
   - Never run `supabase config push` from this repo: it would push the local test CAPTCHA config.
2. **Nothing has run on a real phone.** There's no iPhone Safari run, no real Turnstile challenge and no 4G timing. The PRD's 2.5 s scan-to-menu target is unmeasured.
3. **Realtime had two real bugs, both fixed.**
   - The order page said "Live" while receiving nothing: it joined before the diner's token was attached.
   - It could miss a change in the first moment after connecting.
   - An e2e now proves another diner receives nothing (falsified).
4. **Items in hidden categories are still orderable by a crafted request** (open decision 11). The diner menu never offers them.
5. **The legacy-tag mapping has been rehearsed only locally,** on a database in `main`'s state. Its first real run is your migration on the hosted project.
6. **The menu is read fresh on every request** (open decision 13). PRD 5.9 calls it cacheable; I recommend measuring on a phone first.

**Corrections of earlier claims:**
- **Production outage.** I told you to add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to Production right away. That was wrong: production still runs Brief 02, whose boot check refuses any `NEXT_PUBLIC_` name it doesn't know, so every page returned 500. It should have gone to Preview only until PR #4 merges. The rule is now in `CLAUDE.md` section 1.
- **The offline copy.** I told you (in this session's working notes) that I'd fixed the cart's offline copy. That was wrong: the edit failed silently. It now says "You're offline. Reconnect to place your order.", and the fix is verified. A process rule is logged.
- **Live status.** I told you the order page shows status changes live. It did in the tests, but a change landing in the first moment after connecting could be missed. Now fixed.
- **The brief's redirect status.** The brief says the scan route answers 303. It answers 307, which is what Next's `redirect()` gives in a Route Handler; a GET stays a GET. Builder call (n).
- **The brief's script loading.** The brief says Turnstile loads with `next/script`. It uses a shared one-time loader, because `next/script` left a re-mounted widget blank. Builder call (r).
- **The brief's name for inner pages.** The brief calls a signed-out inner page "the closed state". It shows "Scan the code on your table" instead; a table closed by staff shows "This table has been closed. Thanks for dining!" Builder call (p).

## 5. Acceptance surface

Commands 1 to 5 were re-run while writing this file; expected outcomes in brackets.

1. `git checkout phase-1/brief-03-diner && npm install`, then add `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` to `.env.local`.
2. `npm run db:stop && npm run db:start && npm run db:reset` [Reset local database.] Restarting Supabase picks up the CAPTCHA config.
3. `npm run check` [Tests 161 passed (161) · Files=3, Tests=78 · Result: PASS]
4. `npm run build` [Compiled successfully · six `/t/[token]` routes marked ƒ]
5. `CI=1 npx playwright test` [13 passed]
6. **Ari, by hand:** locally with `npm run dev`, then on the preview after hosted steps 1 and 3 in section 7.
   - Print a card from Brief 02 and scan it with your phone. ["Getting your table ready…", then the menu with the restaurant and table]
   - Tap an item, add two with a note. [The cart bar shows the total]
   - View the order and place it. [The status page shows "Your order's in. The kitchen has it."]
   - From the portal or a second device, move the order to accepted. The staff board is Brief 04, so this is REST or SQL for now. [The phone shows "Accepted…" without a reload]
   - Rotate that table's QR in the portal, then rescan the old card. ["This table code isn't active. Ask your server for help."]

## 6. Falsification record

Each guard was broken on purpose, the listed tests failed, and the guard was restored. Database probes were restored with `supabase db reset`, which returned 78/78. File probes were restored byte-identical.

| Guard broken | Tests that failed |
|---|---|
| dietary-tag check dropped | pgTAP checks 6, 7, 9 |
| time zone trigger dropped | pgTAP checks 2, 3 |
| execute granted on the trigger function | pgTAP checks 10 |
| `invalid_timezone` copy missing | Vitest errors drift test |
| Turnstile secret-shape guard removed from `env.ts` | Vitest env test |
| CAPTCHA switched off in `config.toml` | e2e "Auth refuses sign-ins that carry no Turnstile token" (`invalid_credentials` instead of `captcha_failed`) |
| `orders_read` widened to every signed-in user | e2e "another diner's device receives no realtime changes" (the spy received the change) |
| realtime subscribed without `setAuth()` (the original bug) | e2e live status: "Accepted" never arrived |

## 7. PM items

1. **Vercel:** set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The test key `1x00000000000000000000AA` is fine for Preview; Production needs a real widget's key.
2. **After merge and deploy:** create the Turnstile widget in Cloudflare with the production hostnames, then enable CAPTCHA (Turnstile, real secret) in Supabase Auth. Not before.
3. **Apply the migration** `20260930012807_menu_tag_and_timezone_checks.sql` with `supabase db push`, never `config push`.
4. **Hosted anonymous sign-in limit:** confirm it's raised (local is 200 per hour per IP).
5. **PRD edits:**
   - 5.10's browser variables list becomes four.
   - D1's entry screen can't show the table before sign-in.
   - The table matrix drops delete (decision 10).
6. **Builder calls (n) to (u)** in `CLAUDE.md` section 1. Rule on any you want changed.
7. **Open decision 13 (menu caching).** Recommendation: measure on a phone in Brief 04 first.
8. **Acceptance run** in section 5, step 6, including the phone scan.

## 8. Raw desk tail (2026-09-29, fresh `db:reset`)

```
$ npm run db:reset
{"target":"local","version":"","message":"Reset local database."}
$ npm run check
 Test Files  22 passed (22)
      Tests  161 passed (161)
/Users/ari/salu/supabase/tests/database/phase1_db_checks.test.sql .. ok
/Users/ari/salu/supabase/tests/database/phase1_portal.test.sql ..... ok
/Users/ari/salu/supabase/tests/database/phase1_security.test.sql ... ok
Files=3, Tests=78,  1 wallclock secs ( 0.00 usr  0.01 sys +  0.01 cusr  0.00 csys =  0.02 CPU)
Result: PASS
$ npm run format:check
All matched files use Prettier code style!
$ npx supabase db lint --level warning --fail-on error
No schema errors found
{"results":[],"message":"db lint"}
$ npm run build
✓ Compiled successfully in 987ms
├ ƒ /t/[token]
├ ƒ /t/[token]/cart
├ ƒ /t/[token]/menu
├ ƒ /t/[token]/orders/[orderId]
├ ƒ /t/[token]/unavailable
└ ƒ /t/[token]/welcome
$ CI=1 npx playwright test --reporter=list
  ✓   3 [chromium] › e2e/diner-order.spec.ts:17:5 › a fresh phone scans, passes the device check and lands on the menu (2.7s)
  ✓   2 [chromium] › e2e/portal-setup.spec.ts:31:5 › owner builds a menu: categories, items in cents, the 86 toggle (3.5s)
  ✓   4 [chromium] › e2e/diner-order.spec.ts:34:5 › unknown, rotated and deactivated codes say the table isn't active (2.1s)
  ✓   6 [chromium] › e2e/diner-order.spec.ts:57:5 › opening an inner page without scanning asks for a scan (104ms)
  ✓   5 [chromium] › e2e/portal-setup.spec.ts:112:5 › owner adds tables, rotates a QR code and prints the sheet (2.1s)
  ✓   1 [chromium] › e2e/staff-onboarding.spec.ts:12:5 › owner signs up, confirms email, creates a restaurant and sees the dashboard (7.7s)
  ✓   8 [chromium] › e2e/portal-setup.spec.ts:169:5 › owner changes order timers and the time zone (2.4s)
  ✓   9 [chromium] › e2e/staff-onboarding.spec.ts:57:5 › an anonymous diner session cannot open the staff portal (640ms)
  ✓  10 [chromium] › e2e/staff-onboarding.spec.ts:89:5 › with CAPTCHA on, Auth refuses sign-ins that carry no Turnstile token (5ms)
  ✓   7 [chromium] › e2e/diner-order.spec.ts:62:5 › the menu shows active sections only, sold-out items can't be added, the sheet adds to the cart (3.4s)
  ✓  11 [chromium] › e2e/diner-order.spec.ts:107:5 › placing an order: the database prices it, and a sold-out item is named and removed (9.1s)
  ✓  12 [chromium] › e2e/diner-order.spec.ts:167:5 › a table closed by staff says so instead of opening a new tab (3.2s)
  ✓  13 [chromium] › e2e/diner-order.spec.ts:186:5 › another diner's device receives no realtime changes for someone else's order (7.6s)
  13 passed (29.5s)
$ gitleaks git .
10:22PM INF no leaks found
```
