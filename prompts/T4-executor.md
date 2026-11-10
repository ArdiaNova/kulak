# T4 — Data access, executor and API routes

Read AGENTS.md, PRD.md and load the skills `mandate-guard` and `paypal-payouts`. Do only this task, then stop.

1. `lib/repo.ts`: data access against Supabase (items, suppliers, quotes, mandate, POs, lines, events). Define it behind an interface so tests can use a fake repo.
2. `lib/po.ts`: `createPO(supplierId, lines, rationale, createdBy)`. Prices and total come from supplier_quotes, never from the caller. Round the total to 2 decimals.
3. `lib/executor.ts` with injected repo and PayPal client:
   - `submitPO(poId)`: build GuardInput, run the guard, store decision and reasons, then apply mode: auto+approve → pay; manual+approve or escalate → `pending_approval`; deny → `denied`. Write events.
   - `approvePO(poId)`: only from `pending_approval`; re-run the guard; a `deny` stays denied; otherwise pay.
   - `rejectPO`, `markDelivered` (adds qty to stock, only from `paid`), `syncPayout(poId)` (poll PayPal, apply the status mapping from the skill).
   - Pay step: conditional update `approved → paying` first; only if one row changed, call `createPayout`. On PayPal error set `payment_failed` and write an event.
4. API routes: `GET /api/state` (items with daysLeft, suppliers, quotes, mandate, weekSpent, POs with lines, last 50 events), `PATCH /api/mandate` (Zod-validated), `POST /api/pos/[id]/approve|reject|deliver|sync`, `POST /api/sim/sales` (random plausible stock decrease, never below 0, writes an event), `POST /api/sim/reset` (same effect as supabase/reset.sql), `POST /api/sim/rogue` (creates a PO to the unapproved supplier with an oversized quantity and submits it through `submitPO`; it must end `denied`).
5. Tests with a fake repo and a fake PayPal client: each state transition, double-approve pays once, deny cannot be overridden, rogue ends denied with no PayPal call.

Do not call real PayPal in tests. Acceptance: typecheck, tests, build pass. List each route with an example curl command I can run. Append one line to PROGRESS.md.
