# T6 — PayPal webhook

Read AGENTS.md, PRD.md and load the skill `paypal-payouts`. Do only this task, then stop.

1. `app/api/webhooks/paypal/route.ts` (POST):
   - Read the raw body and the PAYPAL-* headers. Verify the signature with `verifyWebhook` unless `PAYPAL_WEBHOOK_VERIFY=false` and `NODE_ENV !== 'production'`. Invalid → 400, and write an event (type `webhook_rejected`, no secrets).
   - Validate the event shape with Zod. Ignore unknown event types with a 200.
   - For item events, fetch the payout item to read `sender_item_id`, map it to the PO, and apply the status mapping from the skill through the executor. Idempotent: if the PO is already in the target status, do nothing.
   - Write an event with actor `paypal`. For the first few events, also store a trimmed copy of the real payload in `events.detail` so we can see the real shape.
   - Always answer 200 quickly once the event is accepted.
2. Tests with mocked PayPal calls: valid SUCCEEDED → paid; replay → no change; FAILED → payment_failed; unknown PO → logged, 200; bad signature → 400.
3. Then write, with locations, the exact steps for me to register the webhook (browser: PayPal dashboard, my app, Sandbox Webhooks, Add Webhook) with the deployed URL and which events to subscribe to, and where to put the Webhook ID.

Acceptance: typecheck, tests, build pass. Append one line to PROGRESS.md.
