# T1 — Foundation

Read AGENTS.md and PRD.md. Do only this task, then stop.

1. Install with npm: dependencies `@supabase/supabase-js openai zod ag-grid-community ag-grid-react`; dev dependencies `vitest tsx`.
2. package.json scripts: `typecheck` = `tsc --noEmit`, `test` = `vitest run`.
3. Add a vitest config (node environment, resolve the `@/*` path alias used by tsconfig).
4. `lib/env.ts`: Zod-validated env using the names in .env.example. Validate lazily (on first access), so `npm run build` does not crash when env vars are missing.
5. `lib/db.ts`: server-only Supabase client created from SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
6. `app/api/health/route.ts`: returns `{ ok: true, db: boolean, time: string }`. `db` is true when a simple select from `items` succeeds. Never return error details or secrets.
7. Replace the default home page with a minimal "Kulak" placeholder. No UI work yet.
8. Add one trivial test so `npm test` has something to run.

Acceptance: `npm run typecheck`, `npm test` and `npm run build` all pass. Report the versions of next, react, ag-grid-community, ag-grid-react and openai that were installed.
Then tell me, with locations: what to put in .env.local, and which commands to run to check /api/health.
Append one line to PROGRESS.md.
