---
name: mandate-guard
description: Exact rules, types and required unit tests for Kulak's spending mandate (approve / escalate / deny on purchase orders). Use when writing or changing lib/guard.ts or its tests.
---

# Mandate guard

Files: `lib/guard.ts` (pure) and `lib/guard.test.ts`. No I/O, no LLM, no `Date.now()`. Time is the input `now`.

## Types
```ts
type Decision = 'approve' | 'escalate' | 'deny'
type Reason = { code: string; severity: 'deny' | 'escalate'; message: string }
type GuardResult = { decision: Decision; reasons: Reason[] }

type GuardInput = {
  po: { supplierId: string; total: number; lines: { itemId: string; qty: number; unitPrice: number }[] }
  mandate: { autoApproveCap: number; hardBlockCap: number; weeklyBudget: number; maxQtyMultiple: number; maxPriceSpikePct: number }
  supplier: { id: string; approved: boolean }
  quotes: Map<string, { unitPrice: number; lastPaidPrice: number | null; moq: number }> // key = itemId, quotes of THIS supplier
  items: Map<string, { avgDailyUse: number }>
  weekSpent: number // sum of totals of POs in approved|paying|paid|delivered created in the last 7 days
  openPOs: { supplierId: string; itemIds: string[]; status: string; createdAt: Date }[]
  now: Date
}
```

## Rules
Evaluate ALL rules and collect every reason. "Over" means strictly greater, so exactly at a cap is fine.

| Code | Severity | Condition |
|---|---|---|
| SUPPLIER_NOT_APPROVED | deny | `supplier.approved === false` |
| ITEM_NOT_QUOTED | deny | a line's item has no entry in `quotes` |
| INVALID_QTY | deny | any line has `qty <= 0` or `qty < moq` |
| TOTAL_OVER_HARD_CAP | deny | `total > hardBlockCap` |
| DUPLICATE_OPEN_PO | deny | an open PO (status pending_approval, approved, paying or paid) with the same supplier and at least one shared item was created less than 24 h before `now` |
| TOTAL_OVER_AUTO_CAP | escalate | `total > autoApproveCap` |
| WEEKLY_BUDGET_EXCEEDED | escalate | `weekSpent + total > weeklyBudget` |
| QTY_UNUSUAL | escalate | any line has `qty > maxQtyMultiple * avgDailyUse * 7` |
| PRICE_SPIKE | escalate | `lastPaidPrice != null` and `unitPrice > lastPaidPrice * (1 + maxPriceSpikePct/100)` |

Decision: any `deny` → `deny`. Else any `escalate` → `escalate`. Else `approve`.
Messages must be human-readable and include the numbers, e.g. "Total $217.50 is over the $200.00 auto-approve cap".

## Mode (handled in lib/executor.ts, NOT in the guard)
| Guard | Mode auto | Mode manual |
|---|---|---|
| approve | pay now | pending_approval (owner clicks) |
| escalate | pending_approval | pending_approval |
| deny | denied | denied |
A human Approve on an escalated PO re-runs the guard and pays. A human can NOT override a `deny`.

## Tests (vitest, one file, table-driven)
- Baseline PO that approves.
- One test per rule code, triggered alone.
- Boundary: total exactly at auto cap, at hard cap, at weekly budget → no reason.
- Multiple reasons at once (unapproved supplier + unusual qty) → deny with both reasons.
- Duplicate: 23 h old → deny; 25 h old → ok; paid vs drafted vs rejected status.
- Price spike: exactly +20% → ok; +20.1% → escalate; `lastPaidPrice null` → ok.
- `now` injected: same input, different `now`, deterministic result.
