# Decisions

Append-only. Newest at the bottom. Mirror product-level decisions into the PRD's open-questions table in Notion.

- 2026-09-28: Diners use Supabase anonymous auth, created at QR scan. No diner accounts in Phase 1.
- 2026-09-28: A QR code encodes a stable per-table token (`/t/<token>`), not a session id. Staff can rotate it.
- 2026-09-28: All order writes go through the `place_order` RPC. Prices are snapshotted from the DB.
- 2026-09-28: Phase 1 diners see only their own orders. Shared-table visibility is decided in Phase 4.
- 2026-09-28: Next.js 16 `proxy.ts` replaces `middleware.ts`. Tailwind v4 CSS-first config.
- 2026-09-28: Brand color TBD (blue from the design board vs green from the February portal). Tokenized until decided.
- 2026-09-28: Stack reviewed against Nautilly (Expo) and Bonerot (Unity + Firebase). Staying on Next.js + Supabase + Vercel. Diners need no-download web, and the data is relational with DB-enforced security.
- 2026-09-28: All Supabase access goes through `src/lib/` as the portability seam (enforced by the pre-commit hook).
- 2026-09-28: Cloudflare Turnstile moves from Phase 2 to Brief 03. Supabase CAPTCHA is project-wide, so staff forms likely need it too (verified in Brief 03).
- 2026-09-28: Claude Code commits per task and opens one PR per brief. Ari reviews and merges.
- 2026-09-28: Local container runtime is colima (Docker-compatible, free for commercial use) instead of Docker Desktop.
- 2026-09-28: Dependencies at latest compatible versions. Two held back: TypeScript 6.0 (typescript-eslint, used by eslint-config-next, supports TS < 6.1) and ESLint 9 (eslint-config-next's react, import and jsx-a11y plugins crash on ESLint 10). Revisit when eslint-config-next supports them.
- 2026-09-28: Node 22 pinned (`.nvmrc`, `engines`). Vercel should use Node 22 to match.
- 2026-09-28: The pgTAP fixtures now scope lookups to the test's own restaurant, because `supabase test db` runs after `seed.sql` and menus are publicly readable. No assertion changed.
- 2026-09-28: Staff email confirmation uses the token_hash template in `supabase/templates/confirmation.html`. The hosted project needs the same template in Dashboard > Auth > Email Templates.
- 2026-09-28: Local mail is Mailpit (the Supabase CLI replaced Inbucket). Same port, 54324; e2e reads its API.
- 2026-09-28: Staff passwords are at least 10 characters in both zod and Supabase Auth (`minimum_password_length`).
- 2026-09-28: Test-only dependencies beyond the scaffold table: `vite` (peer of vitest 5 and @vitejs/plugin-react 6), `@testing-library/jest-dom` (DOM matchers) and `@testing-library/user-event` (realistic clicks in render tests). No runtime dependencies were added.
- 2026-09-28: `next dev` writes a managed "Next.js agent rules" block into CLAUDE.md pointing at the version-matched docs in `node_modules/next/dist/docs`. Kept: it's useful and is re-added on every `next dev` anyway.
- 2026-09-28: Form Server Actions return `FormResult` (`src/lib/errors.ts`): the `{ ok, data } | { ok: false, error }` shape plus `fieldErrors` and echoed `values` on failure, and `null` as the idle state for `useActionState`.
- 2026-09-28: The CI Supabase CLI is pinned to the `supabase` devDependency version so the generated-types drift check is stable.
