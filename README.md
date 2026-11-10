# Kulak

Kulak is an AI purchasing agent for a small café. It watches stock, compares supplier
quotes, drafts purchase orders and — when the numbers allow it — pays the supplier through
PayPal Payouts. It can only spend inside a **spending mandate enforced in plain code**, not
by the model: every order is re-checked by `lib/guard.ts` before a single cent moves.

Live demo: <https://kulak.vercel.app> (PayPal **sandbox**, no real money). MIT licensed.

## How it works

```
Browser — one page, no login (app/page.tsx, components/)
  │  GET  /api/state                     POST /api/agent/stream  (SSE trace)
  ▼                                      ▼
Next.js route handlers (app/api/)
  │                                      lib/agent.ts — tool loop, max 14 rounds
  │                                        tools: get_mandate · get_inventory
  │                                        get_open_purchase_orders · get_supplier_quotes
  │                                        create_purchase_order · submit_purchase_order
  │                                      │
  │                                      lib/agent.tools.ts (Zod) → lib/po.ts
  │                                      totals computed from supplier_quotes, never from the model
  │                                      │
  │                                      lib/guard.ts (pure, 9 rules) → approve | escalate | deny
  │                                      │ approved (auto mode)
  │                                      lib/executor.ts → lib/paypal.ts → PayPal sandbox REST
  │                                      │
  │                                      purchase_orders: approved → paying
  ▼                                      ▼
Supabase Postgres — service role, server only       PayPal webhook → paid / payment_failed
```

Every agent, guard, human, PayPal and system action writes a row to `events`, which is the
audit timeline on the dashboard.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Data | Supabase Postgres via `@supabase/supabase-js`, service-role key, server-side only |
| LLM | the `openai` npm package pointed at any OpenAI-compatible endpoint with tool calling |
| Validation | Zod for env, every LLM tool argument and every webhook payload |
| Tables | ag-grid-community + ag-grid-react (Community modules, Theming API) |
| Tests | vitest |
| Payments | PayPal Payouts REST (sandbox only) |

## How the AI is used

- The model gets six tools and a system prompt. It decides **what to buy and from whom**, and
  must write a rationale for every order.
- It never receives PayPal credentials and cannot call PayPal. It calls our tool functions;
  only the server calls PayPal, and only through `lib/executor.ts` after the guard has decided.
- Every argument is validated with Zod. Unknown items, missing quotes and bad quantities come
  back to the model as tool errors, not as exceptions.
- Prices and totals are recomputed server-side from `supplier_quotes`; a price sent by the
  model or the browser is never trusted.
- `POST /api/agent/stream` streams each round and tool call over SSE so the dashboard shows
  the agent working instead of a spinner for 15 seconds.

## Owner override (manual order)

The AI is not the only buyer. **New order** in the dashboard lets the owner buy something the
agent did not suggest — a booking on Friday, an item the model thinks is fine. It is the same
path as an agent order: `POST /api/pos` → `lib/po.ts` prices the line from `supplier_quotes` →
`executor.submitPO` → `lib/guard.ts` decides. A human placing the order counts as the approval,
so in manual mode an order the guard approves is paid without a second click; anything over
the auto-approve cap still waits in the inbox, and the hard cap, an unapproved supplier or an
odd price still denies it. The agent never sees the form and cannot use it.

## How PayPal is used

- `lib/paypal.ts` is a small REST wrapper around Payouts: OAuth token, `POST /v1/payments/payouts`,
  `GET /v1/payments/payouts/<batch_id>`, and webhook signature verification.
- Idempotency: `sender_batch_id = kulak-<po_id>` and `sender_item_id = <po_id>`. A PO moves
  `approved → paying` with a conditional update, so a retry can never pay twice.
- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` from the PayPal webhook flips the PO to `paid`; failure
  events flip it to `payment_failed`. Replays are ignored. Batch-level events are logged only.
- If a payout is still `paying`, the dashboard's **Sync with PayPal** button polls the batch
  (`POST /api/pos/:id/sync`) — the same idempotent path, just pull instead of push.

## Setup from scratch

### 1. Supabase (browser: supabase.com, terminal)

Follow [`docs/supabase-setup.md`](docs/supabase-setup.md) — it has the exact clicks. Short
version: create a free project, open **SQL Editor**, run `supabase/schema.sql` then
`supabase/seed.sql`, then copy the **Project URL** and the **service_role** key.

### 2. PayPal sandbox (browser: developer.paypal.com)

1. Log in, open **Apps & Credentials**, make sure the toggle is on **Sandbox**.
2. **Create App** → name `kulak` → **Create App**.
3. Copy the **Client ID** and **Secret** (this is the app that sends payouts).
4. Open **Testing Tools → Sandbox Accounts** and copy the email of a **Personal** account
   (e.g. `sb-xxxx@personal.example.com`). Every supplier payout goes to this one receiver.

### 3. Environment variables (terminal)

```bash
cp .env.example .env.local
nano .env.local
```

`lib/env.ts` validates these lazily with Zod, so `npm run build` works without secrets and a
missing value fails only the request that needs it:

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key, server-side only |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | sandbox app credentials |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WEBHOOK_ID` | filled after step 5 |
| `PAYPAL_WEBHOOK_VERIFY` | `true` (only `false` for local experiments) |
| `SUPPLIER_PAYOUT_EMAIL` | sandbox Personal account that receives payouts |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | any OpenAI-compatible endpoint that supports tool calling |

`.env.local` is gitignored. `lib/env.test.ts` fails if `.env.example` and `lib/env.ts` ever
disagree, so the table above cannot go stale.

### 4. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. In the page: **Reset demo**, then click **auto** in the mandate
panel, then **Run agent**.

### 5. Register the webhook (browser: developer.paypal.com)

PayPal needs a public HTTPS URL, so this comes after the first deploy (step 6). Locally you
can use a tunnel that forwards to port 3000 and register its URL instead.

1. **Apps & Credentials → Sandbox → your app → Webhooks → Add webhook**.
2. **Webhook URL**: `https://<your-domain>/api/webhooks/paypal`.
3. Tick these event types: **PAYMENT.PAYOUTS-ITEM.*** (Succeeded, Failed, Blocked, Returned,
   Unclaimed, Canceled, Refunded, Pending, Held) and optionally **PAYMENT.PAYOUTSBATCH.***.
4. **Save**, then copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID` (locally and in Vercel) and
   redeploy/restart.

### 6. Deploy (browser: vercel.com)

1. Push the repo to GitHub, then **Add New → Project** in Vercel and import it.
2. Add every variable from step 3 as an environment variable (Production and Preview).
3. **Deploy**. The webhook URL from step 5 is `<deployment>/api/webhooks/paypal`.
4. Keep the Supabase project awake: the free plan pauses after ~a week idle, and the demo has
   to stay up until 15 Dec 2026 — a cron hitting `/api/health` every couple of days is enough.

### 7. Tests and checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest, guard / executor / webhook / agent / env
npm run lint        # eslint
npm run build       # production build, no secrets required
```

CI runs typecheck, test and build on every push to `main` and on pull requests
(`.github/workflows/ci.yml`).

### 8. Demo script

[`docs/demo-video-script.md`](docs/demo-video-script.md) is the 2:55 recording plan: pre-flight
checklist, shot list with timestamps, full transcript, recovery table.

## Limitations (honest list)

- **Sandbox only.** `PAYPAL_API_BASE` points at `api-m.sandbox.paypal.com`; nothing here is
  cleared for live money.
- **Seeded data.** Inventory, suppliers and quotes come from `supabase/seed.sql`. There is no
  POS or inventory integration, and "Simulate sales" just writes plausible stock movements.
- **One payout receiver.** All suppliers are paid to the single sandbox Personal account in
  `SUPPLIER_PAYOUT_EMAIL`, because the demo has one verified receiver. Real supplier payout
  emails would be a column on `suppliers`.
- **Payouts through our own REST wrapper.** The PayPal Agent Toolkit has no Payouts tool, so
  `lib/paypal.ts` calls the documented Payouts REST endpoints directly (OAuth + JSON), with
  Zod-validated responses.
- **No auth.** The dashboard has no login: it is a demo, and the mutation routes are meant to
  be public for judging. Add auth before pointing it at a real café.
- **Owner orders are one line at a time.** New order buys a single item from one supplier; a
  multi-line manual basket is not built yet.
- **Weekly spend** is a rolling 7-day sum of orders that reached `approved` or later; it is not
  a ledger and does not net out refunds.

## License

MIT © 2026 ArdiaNova — see [LICENSE](LICENSE).
