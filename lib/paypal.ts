import { z } from "zod";

import { paypalEnv } from "./env";
import { fail, getToken, http, parseResponse, PayPalError } from "./paypal.http";

/**
 * PayPal Payouts wrapper (sandbox). Server-side only.
 *
 * Endpoints and fields verified against developer.paypal.com on 2026-11-10:
 * - POST /v1/oauth2/token (Basic auth, form-encoded grant_type=client_credentials)
 * - POST /v1/payments/payouts, GET /v1/payments/payouts/{id}
 * - GET /v1/payments/payouts-item/{payout_item_id} -> { transaction_status,
 *   payout_item: { sender_item_id, ... } }
 * - POST /v1/notifications/verify-webhook-signature with auth_algo, cert_url,
 *   transmission_id, transmission_sig, transmission_time, webhook_id,
 *   webhook_event -> { verification_status: "SUCCESS" | "FAILURE" }
 *
 * Nothing here logs tokens or credentials.
 */

export { PayPalError, getToken, resetPayPalCache } from "./paypal.http";

const batchHeaderSchema = z.object({
  payout_batch_id: z.string().min(1),
  batch_status: z.string().min(1),
});

const createPayoutSchema = z.object({ batch_header: batchHeaderSchema });

const payoutErrorSchema = z.object({
  name: z.string(),
  message: z.string().nullish(),
});

/** PayPal returns `errors` as an object here; accept an array too. */
const errorsSchema = z
  .union([payoutErrorSchema, z.array(payoutErrorSchema)])
  .nullish();

const batchSchema = z.object({
  batch_header: batchHeaderSchema,
  items: z
    .array(
      z.object({
        payout_item_id: z.string().min(1),
        transaction_status: z.string().min(1),
        payout_item: z.object({ sender_item_id: z.string().nullish() }).nullish(),
        errors: errorsSchema,
      }),
    )
    .nullish(),
});

const payoutItemSchema = z.object({
  payout_item_id: z.string().min(1),
  transaction_status: z.string().min(1),
  payout_batch_id: z.string().nullish(),
  payout_item: z.object({ sender_item_id: z.string().nullish() }).nullish(),
});

const verifySchema = z.object({ verification_status: z.string() });

export type PayoutResult = { batchId: string; status: string };

export type PayoutError = { name: string; message: string };

export type PayoutBatch = {
  batchId: string;
  status: string;
  items: {
    itemId: string;
    status: string;
    senderItemId: string | null;
    errors: PayoutError[];
  }[];
};

export type PayoutItem = {
  itemId: string;
  status: string;
  senderItemId: string | null;
  batchId: string | null;
};

export type WebhookHeaders =
  | { get(name: string): string | null }
  | Record<string, string | undefined>;

export async function createPayout(input: {
  poId: string;
  amount: number;
  receiver: string;
  note?: string;
}): Promise<PayoutResult> {
  const token = await getToken();
  const body = {
    sender_batch_header: {
      sender_batch_id: `kulak-${input.poId}`,
      email_subject: "Kulak payment",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: input.amount.toFixed(2), currency: "USD" },
        receiver: input.receiver,
        note: input.note ?? `Kulak PO ${input.poId.slice(0, 8)}`,
        sender_item_id: input.poId,
      },
    ],
  };

  const { res, json } = await http("/v1/payments/payouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(res.status, json);

  const parsed = parseResponse(createPayoutSchema, json, "create payout");
  return {
    batchId: parsed.batch_header.payout_batch_id,
    status: parsed.batch_header.batch_status,
  };
}

export async function getPayoutBatch(batchId: string): Promise<PayoutBatch> {
  const token = await getToken();
  const { res, json } = await http(`/v1/payments/payouts/${encodeURIComponent(batchId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) fail(res.status, json);

  const parsed = parseResponse(batchSchema, json, "payout batch");
  return {
    batchId: parsed.batch_header.payout_batch_id,
    status: parsed.batch_header.batch_status,
    items: (parsed.items ?? []).map((item) => ({
      itemId: item.payout_item_id,
      status: item.transaction_status,
      senderItemId: item.payout_item?.sender_item_id ?? null,
      errors: (item.errors ? (Array.isArray(item.errors) ? item.errors : [item.errors]) : []).map(
        (error) => ({ name: error.name, message: error.message ?? "" }),
      ),
    })),
  };
}

export async function getPayoutItem(itemId: string): Promise<PayoutItem> {
  const token = await getToken();
  const { res, json } = await http(
    `/v1/payments/payouts-item/${encodeURIComponent(itemId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) fail(res.status, json);

  const parsed = parseResponse(payoutItemSchema, json, "payout item");
  return {
    itemId: parsed.payout_item_id,
    status: parsed.transaction_status,
    senderItemId: parsed.payout_item?.sender_item_id ?? null,
    batchId: parsed.payout_batch_id ?? null,
  };
}

function header(headers: WebhookHeaders, name: string): string | null {
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as Headers).get(name);
  }
  const record = headers as Record<string, string | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (record[key] ?? null) : null;
}

export async function verifyWebhook(
  headers: WebhookHeaders,
  body: unknown,
): Promise<boolean> {
  const { PAYPAL_WEBHOOK_ID } = paypalEnv();
  if (!PAYPAL_WEBHOOK_ID) {
    throw new PayPalError(0, "MISSING_WEBHOOK_ID", "PAYPAL_WEBHOOK_ID is not set.");
  }

  const fields = {
    auth_algo: header(headers, "paypal-auth-algo"),
    cert_url: header(headers, "paypal-cert-url"),
    transmission_id: header(headers, "paypal-transmission-id"),
    transmission_sig: header(headers, "paypal-transmission-sig"),
    transmission_time: header(headers, "paypal-transmission-time"),
  };
  if (Object.values(fields).some((value) => !value)) return false;

  const token = await getToken();
  const { res, json } = await http("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...fields, webhook_id: PAYPAL_WEBHOOK_ID, webhook_event: body }),
  });
  if (!res.ok) fail(res.status, json);

  const parsed = parseResponse(verifySchema, json, "webhook verification");
  return parsed.verification_status === "SUCCESS";
}
