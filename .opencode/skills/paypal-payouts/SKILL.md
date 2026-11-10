---
name: paypal-payouts
description: Send and track PayPal sandbox Payouts for Kulak and handle payout webhooks (token, create batch, poll batch, verify webhook, event-to-status mapping). Use when writing lib/paypal.ts, the executor payment step, or the webhook route.
---

# PayPal Payouts (sandbox)

All PayPal code lives in `lib/paypal.ts`. Base URL from env `PAYPAL_API_BASE` (sandbox: https://api-m.sandbox.paypal.com). Never log secrets or tokens.

## Verified against the user's own sandbox (smoke test succeeded)
- Token: `POST /v1/oauth2/token`, HTTP Basic `client_id:client_secret`, body `grant_type=client_credentials` (form-encoded). Response has `access_token` and `expires_in`. Cache the token in memory until ~60 s before expiry.
- Create payout: `POST /v1/payments/payouts`, `Authorization: Bearer <token>`, JSON:
  ```json
  {
    "sender_batch_header": { "sender_batch_id": "kulak-<po_id>", "email_subject": "Kulak payment" },
    "items": [{
      "recipient_type": "EMAIL",
      "amount": { "value": "91.00", "currency": "USD" },
      "receiver": "<SUPPLIER_PAYOUT_EMAIL>",
      "note": "Kulak PO <short id>",
      "sender_item_id": "<po_id>"
    }]
  }
  ```
  Response: `batch_header.payout_batch_id`, `batch_header.batch_status` = `PENDING`.
- Poll: `GET /v1/payments/payouts/{payout_batch_id}`. `batch_header.batch_status` went PENDING → SUCCESS within about a minute in sandbox.

## Webhook events (verified in PayPal docs)
Batch: `PAYMENT.PAYOUTSBATCH.PROCESSING`, `.SUCCESS`, `.DENIED`. Batch webhooks carry NO item info.
Item: `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `.FAILED`, `.BLOCKED`, `.HELD`, `.RETURNED`, `.REFUNDED`, `.UNCLAIMED`, `.CANCELED`.

Mapping to PO status:
| Event | PO status |
|---|---|
| PAYMENT.PAYOUTS-ITEM.SUCCEEDED | paid |
| PAYMENT.PAYOUTS-ITEM.FAILED / BLOCKED / RETURNED / UNCLAIMED / CANCELED / REFUNDED, PAYMENT.PAYOUTSBATCH.DENIED | payment_failed |
| PAYMENT.PAYOUTS-ITEM.HELD, PAYMENT.PAYOUTSBATCH.PROCESSING | stay `paying`, write an event only |
| PAYMENT.PAYOUTSBATCH.SUCCESS | write an event only (the item event sets paid) |

Correlation: we set `sender_item_id = po_id`. The item webhook resource carries `payout_item_id` and HATEOAS links. Fetch the item (`GET /v1/payments/payouts-item/{payout_item_id}`) to read `payout_item.sender_item_id` and map it to the PO. **Log the first real webhook payload and GET response into `events.detail` once, then code against the real shape, not against this note.**

## Signature verification (from memory, VERIFY against developer.paypal.com before coding)
`POST /v1/notifications/verify-webhook-signature` with `auth_algo`, `cert_url`, `transmission_id`, `transmission_sig`, `transmission_time` (from the `PAYPAL-*` request headers), `webhook_id` (env `PAYPAL_WEBHOOK_ID`) and `webhook_event` (the parsed body). Expect `verification_status: "SUCCESS"`. Reject with 400 otherwise.
- Verify against the RAW parsed body exactly as received.
- Sandbox Webhook Simulator events cannot pass verification. `PAYPAL_WEBHOOK_VERIFY=false` is allowed only when `NODE_ENV !== 'production'`.

## Rules
- Payout only after `lib/guard.ts` approval via `lib/executor.ts`. Never call `createPayout` from a route handler or the agent directly.
- Idempotency: conditional UPDATE `approved → paying` before the PayPal call. If the update affects 0 rows, do not call PayPal. `sender_batch_id` is unique per PO, so a retry cannot double-pay.
- If the PayPal call throws, set `payment_failed` and write an event with the error name and `debug_id`.
- Typed `PayPalError { status, name, message, debugId }`. 15 s timeout on every call.
- Webhook handler must be idempotent: ignore an event if the PO is already in the target status.
- Fallback: `POST /api/pos/:id/sync` polls the batch and applies the same mapping, so the demo works if the webhook is slow.
- Currency USD. Amount as a string with 2 decimals.
- The PayPal Agent Toolkit has no Payouts tool in its published tool list, so do not look for one. Payouts use this REST wrapper.
