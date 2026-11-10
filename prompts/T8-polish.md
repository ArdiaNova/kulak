# T8 — Polish, README, license

Read AGENTS.md and PRD.md. Do only this task, then stop.

1. README.md: what Kulak is (3 lines), architecture (short diagram in text), tech stack, how PayPal and AI are each used, setup from scratch (Supabase project, run schema.sql and seed.sql, PayPal sandbox app and accounts, env vars, `npm install`, `npm run dev`), how to deploy, how the webhook is registered, how to run tests, the demo script, honest limitations (sandbox only, seeded data, one payout email for all suppliers, Payouts through our own REST wrapper because the Agent Toolkit has no Payouts tool).
2. LICENSE: MIT, with the year 2026 and the holder name "ArdiaNova". Make sure GitHub will detect it.
3. `.env.example` matches `lib/env.ts` exactly.
4. Run the polish checklist from the `dashboard-ui` skill and fix what is cheap to fix.
5. Remove dead code and TODOs. Keep PROGRESS.md.
6. Final check list for me to run: `npm run typecheck`, `npm test`, `npm run build`.

Acceptance: all three pass, and a stranger could follow the README without asking questions. Append one line to PROGRESS.md.
