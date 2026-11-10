# T2 — Mandate guard

Read AGENTS.md, PRD.md and load the skill `mandate-guard`. Do only this task, then stop.

1. `lib/types.ts`: shared types for items, suppliers, quotes, mandate, purchase orders, PO lines, events, using camelCase in code (map from snake_case where the database is read).
2. `lib/guard.ts`: pure `evaluatePO(input: GuardInput): GuardResult` implementing exactly the rules in the skill. No I/O, no Date.now().
3. `lib/guard.test.ts`: every test listed in the skill, table-driven.

Acceptance: `npm test` passes and the test file covers every rule code, the boundaries, multiple reasons at once, the 24 h duplicate window, and the +20% price spike boundary. `npm run typecheck` passes.
Report the list of rule codes tested. Append one line to PROGRESS.md.
