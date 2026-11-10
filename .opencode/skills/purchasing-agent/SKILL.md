---
name: purchasing-agent
description: Design of Kulak's runtime LLM purchasing agent - tool definitions, tool loop, validation and guard integration. Use when writing lib/agent.ts, lib/prompts.ts or POST /api/agent/run.
---

# Purchasing agent (runtime)

Files: `lib/agent.ts`, `lib/prompts.ts` (copy of `prompts/purchasing-agent.system.md`), `app/api/agent/run/route.ts`.

## Client
`openai` npm package: `new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY })`, `chat.completions.create({ model: LLM_MODEL, messages, tools, tool_choice: 'auto', temperature: 0.2 })`. Check the installed package types for exact parameter names. Any OpenAI-compatible provider must work. The model must support tool calling.

## Loop
1. Messages: system prompt + one user message "Review stock and restock as needed."
2. Call the model. If it returns tool calls, run each (parallel calls allowed), append `tool` messages with JSON results, repeat.
3. Stop when the model returns no tool calls, or after 14 iterations (then stop and report). 14 covers the workflow the prompt mandates (3 reads + one quote call per low item + one create per supplier + one submit per draft + the summary round) with room for a correction; with a real model, 10 was not enough.
4. If the first response has no tool calls and no summary, retry once, then fail with a clear error.
5. Validate every tool call's arguments with Zod. On validation error return `{ error: "..." }` as the tool result so the model can correct itself. Never throw to the model.
6. Record every tool call and result in `events` (actor `agent`, type `tool_call`) and in the returned `trace`.
7. Return `{ trace, summary, purchaseOrders }`.

## Tools (server functions; JSON schema for the model, Zod on the server)
| Tool | Args | Returns |
|---|---|---|
| get_mandate | none | mode, caps, weekly budget, weekSpent, remaining |
| get_inventory | none | items: sku, name, unit, stock, reorderPoint, avgDailyUse, daysLeft |
| get_open_purchase_orders | none | open POs with supplier, items, status, age |
| get_supplier_quotes | `itemIds` (array, or `itemId`) | for each item: quotes with supplierId, supplierName, approved, unitPrice, lastPaidPrice, priceChangePct, moq, leadDays |
| create_purchase_order | `supplierId`, `lines[{itemId, qty}]`, `rationale` (max 300 chars) | po id, server-computed total, guard preview (decision + reasons) |
| submit_purchase_order | `poId` | final status (paying / pending_approval / denied), guard result |

Rules:
- `create_purchase_order` ignores any price from the model. It looks prices up in supplier_quotes and computes the total.
- `submit_purchase_order` calls `lib/executor.ts` `submitPO`, which re-runs the guard (authoritative) and applies the mode. The model never sees PayPal.
- The model cannot read or change the mandate. `get_mandate` is read-only.
- Splitting an order to dodge a cap is caught by WEEKLY_BUDGET_EXCEEDED and DUPLICATE_OPEN_PO. Do not add special handling in the agent.

## Prompt
Use `prompts/purchasing-agent.system.md` verbatim. Do not add secrets, PayPal details or the mandate numbers to the prompt. The agent learns the mandate through `get_mandate`.

## Tests
- Tool arg validation rejects bad input without throwing.
- With a fake model that tries `submit_purchase_order` on an unapproved-supplier PO, the final status is `denied` and no PayPal call is made (inject a fake PayPal client).
- Loop stops at the iteration limit.
