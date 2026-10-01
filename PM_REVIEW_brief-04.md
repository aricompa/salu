# PM review: Brief 04 (live order board and Phase 1 exit)

**Tracked:** yes, committed on the Brief 04 branch with its PR. When Ari rules, add a status banner under this title; don't edit the body.

## 1. Header

- **Date:** 2026-09-30
- **Branch:** `phase-1/brief-04-order-board`, cut from `main @ e491a8f`. This file ships in the commit that opens the PR, together with the fixes from the pre-PR spec audit (section 4, finding 9); the last task commit is `95e07b6` (task 9), then `0ff11d7` (dashboard alignment, screenshots).
- **Worktree:** `/Users/ari/salu`. **Committed:** yes, nothing uncommitted after the PR commit.
- **Desk (2026-09-30, on a fresh `db:reset`):**

| Check | Result |
|---|---|
| Vitest | 210/210, 32 files (one earlier run failed: see finding 10) |
| pgTAP | 107/107, 5 files (43 security + 25 portal + 10 checks + 21 seating + 8 hidden items) |
| Playwright, production build (`CI=1`) | 30 passed, 2 skipped (the long-service and latency probes, which run only on request) |
| `supabase db lint` | no schema errors |
| gitleaks (git history) | 57 commits, no leaks |
| `next build` | every `/t/[token]` and `/restaurant` route dynamic |
| First-load JS (gzip, non-`noModule` scripts) | welcome 137.7, menu 144.5, cart 142.5, order 140.8, not-seated 135.8 KB (budget 150) |
| Long-service probe (at `e9d6720`) | passed: a new order reached the board 15 s after its first token expired, in 1,032 ms, indicator stayed "Live" |
| Latency probe (at `e9d6720`, local production build, 20 orders) | p50 144 ms, p95 173 ms, max 308 ms |
| Spec reconciliation | 57 checks, 34 match, 13 divergences (6 explained), 5 cannot-verify, plus 5 source conflicts; no security divergences. The 7 unexplained ones are fixed or logged (finding 9) |

- **Gate:** `DESK-GREEN`. Not `PM-ACCEPTED`: that needs the hosted rollout (section 7, item 2) and the on-device half of the Phase 1 exit (section 5).

## 2. Bottom line

Staff can run service from a live board: orders arrive within a fraction of a second on a local production build, with a chime, a pulse and a screen-reader line; each tap moves an order one column; cancel asks first; a stale tap says the order already moved on. Tables take orders only after staff tap Seat, so a photographed code is useless from home. Diners can give a name, and see Sent, Accepted, Preparing, Served. Staff sign-in, sign-up and the new password reset run in the browser. What limits what this is worth today: **none of it has run on the hosted project or a phone.** The two Brief 04 migrations aren't on the hosted database, so the PR's Vercel preview can't be used for acceptance (its Settings page and Seat button need the new column and RPC), and applying them before merging would lock every diner out of production. The Phase 1 exit's on-device criteria (iPhone Safari, the fake dinner, 3 s menu, 2 s board p95 on the hosted system) are all still open.

## 3. Scope

Built, by task (each one commit; build calls are logged in `CLAUDE.md` section 1 as (v) to (bk)):

1. **Orders board** (`/restaurant/orders`): New, Accepted, Preparing, Ready; "Done today" in the restaurant's zone; ticket-age timers with text at 10 and 20 minutes; notes labelled; one next step per card; Cancel (not on Ready) behind "Keep order" / "Cancel order"; Live / Reconnecting; sound behind "Turn on sound"; new-order alert by id comparison. Floor staff use all of it.
2. **Seat and close tables**: migration (`require_staff_open`, `open_table_session`, `join_table` refuses unseated tables); a Tables strip on the board; `/t/[token]/not-seated`; a Settings toggle.
3. **Diner names and the timeline without Ready**: a once-per-session name sheet with Skip as big as Save; "Guest N" on the board; a ready order reads as Preparing on the phone.
4. **Dashboard live counts**: open tables, orders waiting, average time to serve; "Place a test order" opens the first table's scan URL.
5. **e2e and probes**: two-browser happy path; long-service and latency probes as on-request specs.
6. **Toast** for the staff portal, used by board actions and QR rotation.
7. **Staff auth in the browser and password reset**, with a new-password page for staff sessions only.
8. **PWA manifest and generated icons.**
9. **`place_order` refuses items in hidden or missing categories.**

Deliberately not built: table view toggle, late add-on badges, table requests, staff invites, configurable ticket thresholds (Phase 2); live table closure on diner pages (ruled out); menu caching (open decision 13, measure only); brand colour (open decision 1); live updates of the Tables strip across tablets (`table_sessions` stays out of the publication).

## 4. Findings you must see before accepting

1. **Rollout order: merge first, then `supabase db push`.** Old code with the new database locks every diner out (it has no Seat button). New code with the old database only breaks Settings and Seat until the push. Nothing in the hosted project changes until you run the push.
2. **Seating is on by default for your existing restaurant.** Right after the push, every table needs a tap on Seat before its code takes orders; a diner who scans first sees "Your table isn't open yet. Ask your server to seat you, then scan again." Turn it off in Settings if you'd rather keep the old behaviour while testing.
3. **Password reset is broken on the hosted project until you add the email template.** Dashboard > Auth > Email Templates > Reset password: paste `supabase/templates/recovery.html` (its link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`). The hosted Site URL must be the production URL.
4. **The PR's Vercel preview is not an acceptance surface** (finding 1). Run acceptance on production after merge and push, as with Brief 03.
5. **Correction about first-load JS.** Brief 03 recorded the menu at 147 KB without saying how it was measured. I can't reproduce that method. Mine (gzip of every script the page's HTML loads, skipping the legacy `noModule` polyfills that modern browsers never fetch) gave 141.9 KB for the menu before this brief's changes and 144.5 KB now. Counting the polyfill chunk would put every diner page near 180 KB. Either way this brief added 2.6 KB to the menu.
6. **"Average ticket age today" isn't defined** in the brief or the PRD. I built "Average time to serve" (sent to served, today) and labelled it that way. Open decision 14.
7. **Not done:** the read-only check of the hosted Auth settings (the publishable key wasn't at hand without the dashboard; run it before the phone test, section 5). The long-service probe wasn't falsified (that would mean patching supabase-js).
8. **Bug found and fixed in this brief:** after "Back to sign in", a second password-reset request showed the previous answer instead of the form. Regression test added and falsified.
9. **The pre-PR spec audit found no security divergences, and seven others, now handled** (`CLAUDE.md` build calls (bl) to (bs)). Fixed: a tap while the connection is down threw to the error page and replaced the board (it now says "We couldn't reach Salu…" where you tapped); the name-sheet action ran zod after the session lookup; board text under 18 px; a hand-written row type; a stale Close that toasted "Closed A4." for a no-op (**I logged that as harmless in build call (ag); that was wrong**: it now says "That's no longer here."); an untested fail-closed guard (now tested and falsified). Kept and logged: Cancel is a visible button behind a confirmation, not PRD P4's overflow menu.
10. **A flaky test, reported:** one full `npm run check` failed on the Brief 02 `ConfirmDialog` render test ("expected close to be called 2 times, but got 1"). The test asserted the dialog had closed the instant the confirm click returned, while the dialog closes once the action answers; this brief's connection handling added one more await. The test now waits for the close (assertion unchanged); two full runs and five runs of that file are green since.
11. **Correction to my own audit fix.** I first made every failed tap read "We couldn't reach Salu…". That was wrong for an ended session: staff would have been told to check the Wi-Fi when they needed to sign in again. Now only a failed fetch or an offline device reads that way; a Server Action whose session has ended sends staff to `/login` (the proxy lets action requests through, and every portal action re-checks the session itself). A page request with a forged action header still lands on `/login`. Both have e2e tests.

## 5. Acceptance surface

Desk (any machine with local Supabase; each verified on this branch before writing it down):

```bash
npm run db:reset && npm run check          # [Vitest 210/210, pgTAP 107/107]
npm run build && CI=1 npx playwright test  # [30 passed, 2 skipped]
npm run build && CI=1 SALU_LATENCY_PROBE=1 npx playwright test e2e/latency.spec.ts
                                           # [1 passed; prints LATENCY {..."p95":<2000...}]
```

Long-service probe (local only, never pushed): set `jwt_expiry = 120` in `supabase/config.toml`, `npm run db:stop && npm run db:start`, run `SALU_LONG_SERVICE_PROBE=120 npx playwright test e2e/long-service.spec.ts` [1 passed in about 2.5 minutes], then restore the file (`git checkout supabase/config.toml`) and restart.

Hosted, after merge and `supabase db push` (yours):

1. Read-only: `curl "$SUPABASE_URL/auth/v1/settings" -H "apikey: $PUBLISHABLE_KEY"` [`"anonymous_users":true`].
2. Sign in on the tablet or laptop; open Orders [Live; Tables strip lists your tables as "Not seated"].
3. Scan a table's printed code on an iPhone in Safari [Your table isn't open yet]. Tap Seat on the board, scan again [menu, then "What should we call you?"].
4. The fake dinner: two or more phones at one table, each names itself or skips, each orders [cards appear with names or Guest N, chime once sound is on].
5. Accept, Start preparing, Mark ready, Mark served [each phone follows live; at Ready the phone still says Preparing].
6. Close the table [a phone's next order attempt says the table was closed; a rescan says it isn't open yet].
7. Timing: menu interactive in under 3 s on restaurant Wi-Fi; each order on the board within 2 s (by eye or a stopwatch for 20 orders).
8. Forgot password on `/login` [the same "If an account exists…" answer for any email; the email link opens "Set a new password"].
9. Supabase security advisor [0 errors].

## 6. Falsification record

| Guard | Broken how | Failed | Restored |
|---|---|---|---|
| `join_table` refuses an unseated table | seating check off | seating 5, 6, 17 | byte-identical, `b518836e58805945` |
| `open_table_session` membership | check removed | seating 7, 8 | same |
| deactivated tables can't be seated | check removed | seating 12 | same |
| signed-out visitors can't call `open_table_session` | granted to `anon` | seating 2 | same |
| only owners and managers change seating | policy widened to any member | seating 13, 17 | same (existing policy) |
| `place_order` refuses hidden or uncategorised items | category join removed | hidden items 3 to 6, 8 | byte-identical, `3aa64cf956d65ee3` |
| new-password page needs a staff session | `getClaims()` check removed | e2e "the new-password page is for signed-in staff only" | byte-identical, `719eb45248b74e10` |
| a second reset request shows the form | fresh-round fix removed | render test "can send another after going back" | byte-identical |
| a restaurant with no settings row requires seating | `coalesce(..., true)` flipped to `false` | seating 21 | byte-identical, `b518836e58805945` |
| a dropped connection shows next to the button | `.catch` removed from `ActionButton` | render test "shows next to an ActionButton instead of throwing" | byte-identical |
| an ended session goes to sign-in, not "check the connection" | (before the fix) proxy redirected action requests | e2e "a board whose session has ended sends staff to sign in" | n/a: the test was written first and failed, then the fix |

## 7. PM items

1. **Open decision 14:** what "average ticket age today" means. Recommendation: keep "Average time to serve" (sent to served, today).
2. **Rollout:** merge, then `supabase db push`, then the Reset password template, then the section 5 hosted steps. Recommendation: in that order, on production, as with Brief 03.
3. **Builder calls (v) to (bk)** in `CLAUDE.md` section 1: accept as built, or name the ones to rework.
4. **PRD edits** (already on your list): D6 and 5.7 without diner-facing Ready; Q3 built; the table matrix without delete; 5.10's four browser variables; D1's entry screen; now also P3's "average ticket age" wording once decision 14 is ruled.
5. **Before the pilot** (unchanged): a real Turnstile widget before hosted CAPTCHA goes on; custom SMTP (reset emails count against the built-in limit too).
6. **How first-load JS is measured** (finding 5): count the legacy polyfill chunk or not. Recommendation: don't; modern browsers never download it, and that is what the 150 KB budget is protecting.
7. **"Guest N" numbering.** Built as the brief says (position by join time among everyone at the table), so the second diner to skip can be "Guest 3" if a named diner joined in between, and a staff member testing a table counts too. Alternative: number only unnamed diners. Recommendation: number only unnamed diners; it's one line in `src/lib/board.ts`.
8. **Closed-table copy with seating on.** A diner whose table was closed reads "Scan the code again to start a new tab", but a rescan now says to ask the server. Recommendation: change it to "Thanks for dining! To order again, ask your server to seat you." when you confirm seating stays on by default.
9. **14 px field hints in the portal** (an `Input` pattern since Brief 01) against PRD 5.4's 16 px body minimum. Recommendation: raise hints to 16 px in the portal in the next brief.
10. **A stale pgTAP test name:** "scanning after close opens a new session" now passes because the fixture seats the table again. Renaming it changes an assertion's text, which the seating ruling said not to do. Recommendation: allow the rename.

## 8. Raw desk tail

```
 Test Files  32 passed (32)
      Tests  210 passed (210)
/Users/ari/salu/supabase/tests/database/phase1_db_checks.test.sql ..... ok
/Users/ari/salu/supabase/tests/database/phase1_hidden_items.test.sql .. ok
/Users/ari/salu/supabase/tests/database/phase1_portal.test.sql ........ ok
/Users/ari/salu/supabase/tests/database/phase1_seating.test.sql ....... ok
/Users/ari/salu/supabase/tests/database/phase1_security.test.sql ...... ok
All tests successful.
Files=5, Tests=107,  0 wallclock secs
Result: PASS
CI=1 npx playwright test: 2 skipped, 30 passed (37.3s)
```
