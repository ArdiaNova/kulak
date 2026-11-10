# T3 — PayPal wrapper and smoke test

Read AGENTS.md, PRD.md and load the skill `paypal-payouts`. Do only this task, then stop.

1. `lib/paypal.ts`: `getToken()` (cached), `createPayout({ poId, amount, receiver, note })`, `getPayoutBatch(batchId)`, `getPayoutItem(itemId)`, `verifyWebhook(headers, body)`. Typed `PayPalError`, 15 s timeout, no secrets in logs. Before writing `verifyWebhook`, check the official PayPal docs for the exact request fields and say what you verified.
2. `scripts/paypal-smoke.ts`: reads env, sends ONE $1.00 payout to SUPPLIER_PAYOUT_EMAIL with a unique batch id (`kulak-smoke-<timestamp>`), then polls the batch every 5 s for up to 90 s and prints the status. Make it runnable with the env loaded from .env.local. Find a command that works on Node 20 (for example `npx tsx --env-file=.env.local scripts/paypal-smoke.ts`, or `node --env-file=.env.local --import tsx ...`), try it with `--help` or a dry check that does not send money, and tell me the exact command.
3. Unit tests for `lib/paypal.ts` with `fetch` mocked: token caching, error mapping, request body shape for createPayout.

Do NOT run the smoke script yourself. I will run it.
Acceptance: typecheck and tests pass. Give me the exact smoke command and what a good output looks like. Append one line to PROGRESS.md.
