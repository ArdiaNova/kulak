import { z } from "zod";

import type { Executor } from "@/lib/executor";
import { PayPalError, type WebhookHeaders } from "@/lib/paypal";
import type { Repo } from "@/lib/repo";

/**
 * PayPal webhook handling, kept out of the route so it can be tested without a
 * server. PayPal sends the event; we never trust it blindly: the signature is
 * verified first, then the payout item is fetched to learn which PO it belongs
 * to (our own `sender_item_id`), then the executor applies the status.
 */

export type WebhookDeps = {
  repo: Repo;
  executor: Executor;
  verify: (headers: WebhookHeaders, body: unknown) => Promise<boolean>;
  getItem: (itemId: string) => Promise<{ status: string; senderItemId: string | null }>;
  skipVerify: boolean;
};

export type WebhookOutcome = {
  status: number;
  body: { ok: boolean; action: string };
};

const eventSchema = z
  .object({
    id: z.string().optional(),
    event_type: z.string().min(1),
    resource: z
      .object({
        payout_item_id: z.string().optional(),
        payout_batch_id: z.string().optional(),
        transaction_status: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const ITEM_SUCCEEDED = "PAYMENT.PAYOUTS-ITEM.SUCCEEDED";
const ITEM_FAILED = new Set([
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
  "PAYMENT.PAYOUTS-ITEM.CANCELED",
  "PAYMENT.PAYOUTS-ITEM.REFUNDED",
]);
const ITEM_LOGGED = new Set(["PAYMENT.PAYOUTS-ITEM.HELD", "PAYMENT.PAYOUTS-ITEM.PENDING"]);
const BATCH_EVENTS = new Set([
  "PAYMENT.PAYOUTSBATCH.PROCESSING",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTSBATCH.BLOCKED",
]);

/** The PO status a PayPal event implies, or null when it only gets logged. */
export function targetStatusFor(eventType: string): "paid" | "payment_failed" | null {
  if (eventType === ITEM_SUCCEEDED) return "paid";
  if (ITEM_FAILED.has(eventType)) return "payment_failed";
  return null;
}

/** A trimmed copy of the payload, safe to keep in the audit trail. */
function trim(payload: unknown): unknown {
  const event = payload as {
    id?: unknown;
    event_type?: unknown;
    resource?: Record<string, unknown>;
  };
  const resource = event.resource ?? {};
  const item = resource.payout_item as Record<string, unknown> | undefined;
  return {
    id: event.id,
    event_type: event.event_type,
    resource: {
      payout_item_id: resource.payout_item_id,
      payout_batch_id: resource.payout_batch_id,
      transaction_status: resource.transaction_status,
      payout_item: item
        ? { sender_item_id: item.sender_item_id, amount: item.amount, receiver: item.receiver }
        : undefined,
    },
  };
}

export async function handleWebhook(
  raw: string,
  headers: WebhookHeaders,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const reject = async (reason: string): Promise<WebhookOutcome> => {
    await deps.repo.insertEvent({ actor: "paypal", type: "webhook_rejected", detail: { reason } });
    return { status: 400, body: { ok: false, action: reason } };
  };

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return reject("invalid_json");
  }

  if (!deps.skipVerify) {
    try {
      if (!(await deps.verify(headers, payload))) return reject("bad_signature");
    } catch (error) {
      const name = error instanceof PayPalError ? error.name : "verify_failed";
      return reject(name);
    }
  }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return reject("invalid_event_shape");
  const event = parsed.data;

  // Looking at the raw shape once is how we learned it; keep a few trimmed copies.
  const seen = await deps.repo.listEvents(200);
  const firstFew = seen.filter((row) => row.type === "webhook_received").length < 3;

  if (BATCH_EVENTS.has(event.event_type)) {
    // Batch events carry no item, so the PO cannot be identified here. The item
    // event (or POST /api/pos/:id/sync) settles the order.
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_received",
      detail: {
        eventType: event.event_type,
        batchId: event.resource?.payout_batch_id ?? null,
        applied: null,
        ...(firstFew ? { payload: trim(payload) } : {}),
      },
    });
    return { status: 200, body: { ok: true, action: "batch_logged" } };
  }

  if (!event.event_type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_ignored",
      detail: { eventType: event.event_type },
    });
    return { status: 200, body: { ok: true, action: "ignored" } };
  }

  const itemId = event.resource?.payout_item_id;
  if (!itemId) {
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_ignored",
      detail: { eventType: event.event_type, reason: "no payout_item_id" },
    });
    return { status: 200, body: { ok: true, action: "ignored" } };
  }

  let poId: string | null = null;
  let itemStatus = event.resource?.transaction_status ?? event.event_type;
  try {
    const item = await deps.getItem(itemId);
    poId = item.senderItemId;
    itemStatus = item.status;
  } catch (error) {
    // Answer non-200 so PayPal retries; the event explains why.
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_error",
      detail: { eventType: event.event_type, itemId, name: error instanceof Error ? error.name : "unknown" },
    });
    return { status: 502, body: { ok: false, action: "item_lookup_failed" } };
  }

  if (!poId) {
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_unknown_po",
      detail: { eventType: event.event_type, itemId, senderItemId: null },
    });
    return { status: 200, body: { ok: true, action: "unknown_po" } };
  }

  const po = await deps.repo.getPO(poId);
  if (!po) {
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "webhook_unknown_po",
      detail: { eventType: event.event_type, itemId, senderItemId: poId },
    });
    return { status: 200, body: { ok: true, action: "unknown_po" } };
  }

  const target = targetStatusFor(event.event_type);
  const result = await deps.executor.applyPayoutEvent({
    poId,
    target,
    detail: { source: "webhook", eventType: event.event_type, eventId: event.id ?? null, itemId, itemStatus },
  });

  await deps.repo.insertEvent({
    actor: "paypal",
    type: "webhook_received",
    poId,
    detail: {
      eventType: event.event_type,
      itemId,
      itemStatus,
      status: result.status,
      changed: result.changed,
      ...(firstFew ? { payload: trim(payload) } : {}),
      ...(ITEM_LOGGED.has(event.event_type) ? { note: "no status change for this event" } : {}),
    },
  });

  return {
    status: 200,
    body: { ok: true, action: result.changed ? `applied:${result.status}` : "no_change" },
  };
}
