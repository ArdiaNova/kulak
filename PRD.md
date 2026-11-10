# PRD — Kulak v1

## One-liner
Kulak watches a café's stock, compares suppliers, and pays them through PayPal, inside a spending mandate that plain code enforces, not the AI.

*Kulakan* is Indonesian for buying stock wholesale.

## Problem
Small cafés lose sales to stockouts and lose hours reordering from several suppliers. Handing purchasing and payment to staff or software is risky, because money moves.

## User
Owner or manager of a small café or F&B outlet (1–5 outlets).

## Core idea
The agent plans. Code enforces. PayPal pays.
- The LLM decides what to restock and from whom, and explains why.
- A pure-code mandate decides approve / escalate / deny. The LLM cannot change or bypass it.
- Approved orders are paid with PayPal Payouts (sandbox). A PayPal webhook marks them paid. Delivery refills stock. That is the closed loop.

## Goals
- Low stock to paid purchase order in under 60 seconds, with no typing.
- Every agent action explainable: rationale, guard reasons, audit trail.
- A hostile or buggy agent cannot move money outside the mandate (proved in the demo).

## Non-goals
Login / multi-user, real POS integration, real delivery tracking, tax, real money, mobile layout polish.
(BrewDesk stays private. Kulak is standalone with seeded café data.)

## Flow
1. Stock drops (seeded low, or "Simulate sales").
2. "Run agent": the LLM reads inventory, mandate and open POs, compares supplier quotes, creates draft POs with a rationale, and submits them.
3. Guard evaluates each PO → approve / escalate / deny.
4. Mode auto + approve → payout is sent. Otherwise → approval inbox (escalate) or denied.
5. PayPal webhook `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` → PO becomes paid. A "Sync" button polls PayPal as a fallback.
6. "Mark delivered" → stock increases, PO closed.
7. Everything is written to the audit log with its actor: agent, guard, human, paypal, system.

## Mandate (see skill mandate-guard for exact rules)
Mode manual | auto. Weekly budget, auto-approve cap, hard block cap, max quantity multiple, max price spike %. Defaults: manual, $600, $200, $600, 2.5x, 20%.

## P0 features
1. Dashboard (one page): KPIs, mandate panel, inventory grid, PO grid, approval inbox, audit timeline, agent trace.
2. Agent run (LLM tool loop, see skill purchasing-agent).
3. Guard with unit tests.
4. Executor: create / submit / approve / reject / pay / deliver, with idempotent payout.
5. PayPal Payouts wrapper + webhook (with signature verification) + sync fallback.
6. Demo controls: Simulate sales, Simulate rogue agent, Reset demo.
7. Seed data: 6 items, 5 suppliers (one unapproved and cheapest, one with a price spike).

## P1 (only if everything above works)
Streaming agent trace · PayPal Agent Toolkit `list_transactions` reconciliation panel · cash-out forecast card.

## Data
See supabase/schema.sql: items, suppliers, supplier_quotes, mandate (single row), purchase_orders, po_lines, events.
All suppliers are paid to one sandbox Personal account (env SUPPLIER_PAYOUT_EMAIL).

## Routes
GET /api/health · GET /api/state · PATCH /api/mandate · POST /api/agent/run
POST /api/pos/:id/approve | reject | deliver | sync
POST /api/webhooks/paypal
POST /api/sim/sales | rogue | reset

## Honest notes for the pitch
- PayPal's published Agent Toolkit tool list has no Payouts tool, so Payouts go through our own REST wrapper. The agent still pays only through a guarded tool.
- Suppliers are modelled as paid via PayPal email, which is how Payouts works. Indonesia is the origin story, not a PayPal dependency.

## Demo script (under 3 min, English)
- 0:00 Problem + "the agent can buy, but only inside a mandate".
- 0:15 Dashboard: 5 items below reorder point. Show mandate: auto, $600 week, $200 cap.
- 0:35 Click Run agent. Trace shows it comparing suppliers.
- 1:00 Milk, packaging, syrup orders pass the guard and are paid. Show paying → paid by webhook.
- 1:30 Beans order is escalated (over cap, price +21%). Reasons shown. Owner clicks Approve → paid.
- 2:00 Click Simulate rogue agent: unapproved supplier + oversized quantity → denied with reasons.
- 2:20 Mark delivered → stock refills. Scroll the audit log: agent, guard, human, paypal.
- 2:40 Close: who it is for, what PayPal + AI each do.

## Judging map
| Criterion | Where Kulak shows it |
|---|---|
| Technological Implementation | Tool-calling agent + guard layer + real sandbox Payouts + verified webhook + idempotency |
| Design | One coherent dashboard, status chips, approval inbox, audit trail |
| Potential Impact | Stockouts and manual reordering for small cafés; safe delegation of spending |
| Innovation | Mandate layer between agent and money; rogue-agent test |
| Presentation | Closed-loop demo with a real sandbox payment changing app state |

## Submission checklist (from the Official Rules)
- Public repo with a detectable open source license (MIT) visible in the repo's About section.
- Text description, hosted demo URL or full run instructions, demo video under 3 min on YouTube (public, no copyrighted music).
- PayPal developer platform integration is central; AI tool is used. All materials in English.
- The project must stay available free of charge until the Judging Period ends (Dec 15, 2026). So the hosted demo and its LLM API key must keep working until then.
- Submit on Devpost before Nov 13, 2026 03:00 WIB. Target: Nov 12 evening.

## Risks
- Scope: cut P1 first. Demo script is the real scope.
- LLM tool-calling quality varies by model. Test the chosen model early (task T5).
- LLM key limits: free keys may expire before Dec 15. Decide the runtime provider before deploying.
- Webhook needs a public HTTPS URL, so deploy before building the webhook-dependent demo.
- Sandbox Webhook Simulator events cannot pass signature verification. Test with real payouts.

## Timeline (WIB)
- Nov 10: T1–T3, Supabase set up, guard tested, PayPal smoke payout from code.
- Nov 11: T4–T6, first deploy, webhook registered.
- Nov 12: T7–T8, README, rehearse, record video (by 16:00), submit (by 20:00).

## Done means
`npm run typecheck`, `npm test`, `npm run build` pass; the full demo script runs on the deployed URL from a clean reset; README lets a stranger run it.
