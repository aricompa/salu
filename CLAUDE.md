# CLAUDE.md: Salu

Salu is a mobile-first, self-serve dining platform. A diner scans the QR code on their table, browses the menu, orders, and (from Phase 3) pays from their phone with no app download and no staff interaction. Restaurants manage menus, tables, QR codes and a live order board in a web portal.

**Current phase:** Phase 1, "walking skeleton": restaurant portal plus QR scan, menu, order, and a live staff order board. No payments yet.
**Active brief:** `docs/phase-1/BRIEF-01-foundation.md`. Do the active brief only. Don't start the next brief until Ari merges the current PR.

Source of truth, in priority order:
1. This file (the invariants below are not negotiable)
2. The active brief in `docs/phase-1/`
3. `docs/phase-1/SCAFFOLD-PLAN.md` (target structure and tooling)
4. The Salu PRD in Notion (product and design spec). The repo docs carry what you need to build, so you don't need Notion access.

If these disagree, stop and ask Ari. Don't guess.

---

## Stack (pinned; don't add dependencies without asking)

- **Next.js 16** App Router, **React 19**, **TypeScript strict**
- **Tailwind CSS v4.** CSS-first config: `@import "tailwindcss";` plus `@theme` in `globals.css`. Never write v3 `@tailwind base/components/utilities` directives. They caused the broken dark theme in the February prototype.
- **Supabase**: Postgres 17, Auth (email+password for staff, **anonymous sign-ins for diners**), Realtime (Postgres Changes on `orders`)
- **@supabase/ssr** for cookie sessions, **zod** for validation, **qrcode** for QR images
- **Cloudflare Turnstile** on sign-in and sign-up (from Brief 03; see `docs/phase-1/README.md`)
- **Vitest** for unit tests, **Playwright** for e2e, **pgTAP** via `supabase test db` for database tests
- **Vercel** hosting, GitHub-connected. Every PR gets a preview deployment.
- Later phases only (don't install yet): Stripe, web push, Sentry

## Commands

```bash
npm run dev            # Next.js dev server (localhost:3000)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest
npm run test:e2e       # Playwright (needs local Supabase running)
npm run db:start       # supabase start (Docker required)
npm run db:reset       # supabase db reset: re-applies all migrations + seed
npm run db:test        # supabase test db (pgTAP)
npm run db:types       # regenerate src/lib/db/types.ts from local DB
npm run check          # lint + typecheck + test + db:test (run before every commit)
```

---

## Security invariants (non-negotiable)

Ari treats security as a first-rate requirement, even in development. Violating any of these is a blocking defect.

1. **RLS on every table**, plus explicit minimum grants. New tables get `enable row level security`, policies, and grants in the *same* migration. Default privileges are revoked, so nothing is exposed by accident.
2. **Diners are anonymous Supabase users.** Call `supabase.auth.signInAnonymously()` on first QR scan. Diners never create email or password accounts in Phase 1.
3. **Diners never read `dining_tables` or QR tokens.** The only diner entry point is the `join_table(qr_token)` RPC.
4. **Orders are only created through the `place_order` RPC.** The client sends item ids, quantities and notes. **Never send or trust a price from the client.** The database snapshots names and prices.
5. **Staff order updates change `status` only**, through the DB state machine (`submitted → accepted → preparing → ready → served`, or `cancelled`). Column grants enforce this. Don't widen them. **Orders, sessions and tables with history are never hard-deleted** (FKs are `on delete restrict`). Cancel orders and deactivate tables instead. Realtime DELETE events aren't RLS-filtered the way inserts and updates are, which is one more reason to avoid deletes.
   Floor staff (`role = staff`) can 86 items only through `set_item_availability()`. Price and name edits are owner/manager-only.
6. **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser. The secret key (`sb_secret_...`) is server-only, used only where RLS can't apply, and is **not needed in Phase 1**. Never prefix a secret with `NEXT_PUBLIC_`. Never commit `.env*` files except `.env.example`.
7. **Verify identity on the server with `supabase.auth.getClaims()`** in Server Components, Server Actions and Route Handlers. Never trust `getSession()` user data for authorization. RLS is the real boundary. UI checks are convenience only.
8. **`SECURITY DEFINER` functions** pin `set search_path = ''`, fully qualify every object, check `auth.uid()` and membership themselves, `revoke all ... from public, anon`, and grant execute only to `authenticated`. Put helpers in schema `private` (not exposed via the Data API).
9. **Validate every input twice:** zod in the Server Action, then constraints and checks in the database.
10. **No remote database changes from Claude Code.** Build and test against local Supabase only. Ari applies migrations to the hosted project.

## Architecture rules

- **Routes**
  - Diner: `/t/[token]` (entry), `/t/[token]/menu`, `/t/[token]/cart`, `/t/[token]/orders/[orderId]`. The token URL is the diner's home, and each server render re-resolves the session through RLS.
  - Staff: `/login`, `/restaurant/onboarding`, `/restaurant/(portal)/{dashboard,orders,menu,tables,settings}`.
- **Proxy, not middleware.** Next.js 16 renamed `middleware.ts` to `proxy.ts`. Session refresh lives in `src/proxy.ts` and calls `src/lib/supabase/proxy.ts`. Don't create `middleware.ts`.
- **Server Components by default.** Use `'use client'` only for interactivity (cart, steppers, realtime board).
- **Mutations are Server Actions** in a colocated `actions.ts`. Each one: zod parse, user-scoped server Supabase client, RPC or table call, typed result `{ ok: true, data } | { ok: false, error: { code, message } }`. Map DB error hints (`invalid_table`, `item_unavailable`, `session_closed`, `rate_limited`, `invalid_transition`) to friendly copy in `src/lib/errors.ts`.
- **Realtime:** subscribe to `postgres_changes` on `public.orders`, filtered by `restaurant_id` (staff) or by order `id` (diner). RLS filters rows per subscriber. Always unsubscribe on unmount, and refetch on reconnect.
- **Money:** integer cents everywhere. Format only through `src/lib/money.ts`. Never use floats for currency.
- **Time:** `timestamptz` in the DB. Render in the restaurant's timezone for staff and the device timezone for diners.
- **Generated types:** import DB types from `src/lib/db/types.ts` (generated). Never hand-write row types.
- **All Supabase access goes through `src/lib/`.** Only files under `src/lib/` import `@supabase/*` or call the Supabase client. Pages, components and Server Actions call functions in `src/lib/` (e.g. `src/lib/orders.ts`, `src/lib/realtime.ts`). This is the portability seam: if Salu ever leaves hosted Supabase, the change stays inside `src/lib/`. The pre-commit hook enforces the import rule.
- **Pages that touch auth render dynamically.** Never statically cache pages with user-specific or anonymous-user data (Supabase flags metadata leaking across anonymous users under static rendering).

## Database workflow

- Every schema change gets a **new** file in `supabase/migrations/` (`supabase migration new <name>`). Never edit a migration after it has been applied anywhere.
- Every new policy, grant or RPC gets pgTAP coverage in `supabase/tests/database/`, including a **negative** test (the wrong user is denied).
- After schema changes: `npm run db:reset && npm run db:test && npm run db:types`.
- Keep `supabase/seed.sql` realistic but fake: one demo restaurant, 3 categories, about 12 items, 4 tables. No real personal data.

## UI conventions

- **Diner UI** is light by default and respects `prefers-color-scheme`. It's one-handed and thumb-first: primary actions sit in the bottom 40% of the screen, and touch targets are at least 44×44px.
- **Staff portal** is dark by default (Ari's request). It's designed for a tablet on a pass or counter, so text must be readable at arm's length.
- **Colors come from design tokens** in `globals.css` (`--color-brand`, `--color-surface`, and so on). No raw hex in components. The brand color is **not final** (see `docs/DECISIONS.md`), so keep it a token.
- **Accessibility:** WCAG 2.2 AA. Every control needs a label, focus must be visible, respect `prefers-reduced-motion`, and color is never the only signal (status badges need text).
- **Copy:** short, warm, plain. "Your order's in. The kitchen has it." beats "Order submitted successfully."
- **Handle every state:** loading (skeletons), empty, error, offline.

## Guardrails

- **Pre-commit hook** (`.githooks/pre-commit`) blocks the mechanical violations of this file on staged lines: `middleware.ts`, `.env` files, secret key literals, secret-looking `NEXT_PUBLIC_` names, Tailwind v3 directives, Supabase imports outside `src/lib/`, raw hex colors in components. It warns on `getSession()`, hard deletes, direct order inserts, `force-static` and float-looking money. `npm install` activates it (the `prepare` script sets `core.hooksPath`). **Never use `--no-verify` without asking Ari.**
- **Spec-reconciliation agent** (`.claude/agents/spec-reconciliation.md`) is a read-only audit of the code against this file, the active brief, the scaffold plan and the PRD. Run it before opening every PR.
- **Falsification check** for new security tests: break the policy or RPC, watch the pgTAP test fail, restore it. Say in the PR which tests you checked this way.

## Definition of done (every PR)

- [ ] `npm run check` passes locally. CI is green.
- [ ] Spec-reconciliation agent run; its summary line is in the PR description and every divergence is fixed or explained.
- [ ] New or changed DB behavior has pgTAP tests, including negative cases.
- [ ] Happy-path Playwright test updated when a user flow changes.
- [ ] No secrets in the diff. `.env.example` updated if env vars changed.
- [ ] Screens checked at 390×844 (diner) and 1024×768 (staff).
- [ ] PR description covers what changed, how to test, screenshots, and any decisions made (also append them to `docs/DECISIONS.md`).

## Git

- Branch per brief: `phase-1/brief-01-foundation`, `phase-1/brief-02-portal`, and so on. **Never commit to `main`.**
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Open a PR to `main` and stop. Ari reviews and merges.

## When to stop and ask Ari

- Any change to a security invariant, RLS policy intent, or the order state machine
- Any new dependency or external service
- Anything that needs the hosted Supabase project, Vercel settings, or real credentials
- A brief that is ambiguous or conflicts with this file

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
