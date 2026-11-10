import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPayout,
  getPayoutBatch,
  getPayoutItem,
  getToken,
  PayPalError,
  resetPayPalCache,
  verifyWebhook,
} from "@/lib/paypal";

const BASE = "https://api-m.sandbox.paypal.com";
const EMAIL = "sb-test@personal.example.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock = vi.fn<typeof fetch>();

const token = (accessToken = "token-abc", expiresIn = 300) =>
  fetchMock.mockResolvedValueOnce(json({ access_token: accessToken, expires_in: expiresIn }));

const payout = (batchId = "B1", status = "PENDING") =>
  fetchMock.mockResolvedValueOnce(json({ batch_header: { payout_batch_id: batchId, batch_status: status } }));

const headersOf = (init: RequestInit | undefined) =>
  (init?.headers ?? {}) as Record<string, string>;

const bodyOf = (init: RequestInit | undefined) => JSON.parse(String(init?.body));

const WEBHOOK_HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.paypal.com/cert.pem",
  "paypal-transmission-id": "t-1",
  "paypal-transmission-sig": "sig-1",
  "paypal-transmission-time": "2026-11-10T00:00:00Z",
};

beforeAll(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TEST-1");
  vi.stubEnv("SUPPLIER_PAYOUT_EMAIL", EMAIL);
});

beforeEach(() => {
  resetPayPalCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getToken", () => {
  it("uses basic auth, a form body, and caches the token", async () => {
    token();
    payout();
    payout("B2");

    await createPayout({ poId: "po-1", amount: 91, receiver: EMAIL });
    await createPayout({ poId: "po-2", amount: 5, receiver: EMAIL });

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/v1/oauth2/token"),
    );
    expect(tokenCalls).toHaveLength(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/v1/oauth2/token`);
    expect(headersOf(init).Authorization).toBe(
      `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
    );
    expect(headersOf(init)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(init?.body).toBe("grant_type=client_credentials");
  });

  it("maps a transport failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const error = (await getToken().catch((e) => e)) as PayPalError;
    expect(error).toBeInstanceOf(PayPalError);
    expect(error.status).toBe(0);
    expect(error.name).toBe("NETWORK_ERROR");
  });

  it("maps a timeout", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }));

    const error = (await getToken().catch((e) => e)) as PayPalError;
    expect(error.name).toBe("TIMEOUT");
  });
});

describe("createPayout", () => {
  it("sends the body PayPal expects and returns the batch", async () => {
    token();
    payout("B1", "PENDING");

    const result = await createPayout({
      poId: "1111-2222",
      amount: 91,
      receiver: EMAIL,
      note: "Kulak PO 1111",
    });

    expect(result).toEqual({ batchId: "B1", status: "PENDING" });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${BASE}/v1/payments/payouts`);
    expect(headersOf(init).Authorization).toBe("Bearer token-abc");

    const body = bodyOf(init);
    expect(body.sender_batch_header.sender_batch_id).toBe("kulak-1111-2222");
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      recipient_type: "EMAIL",
      amount: { value: "91.00", currency: "USD" },
      receiver: EMAIL,
      sender_item_id: "1111-2222",
      note: "Kulak PO 1111",
    });
  });

  it("maps a PayPal error without leaking credentials", async () => {
    token();
    fetchMock.mockResolvedValueOnce(
      json({ name: "AUTHENTICATION_FAILURE", message: "Authentication failed.", debug_id: "dbg-1" }, 401),
    );

    const error = (await createPayout({ poId: "po-3", amount: 1, receiver: EMAIL }).catch(
      (e) => e,
    )) as PayPalError;

    expect(error).toBeInstanceOf(PayPalError);
    expect(error.status).toBe(401);
    expect(error.name).toBe("AUTHENTICATION_FAILURE");
    expect(error.debugId).toBe("dbg-1");
    expect(error.message).not.toContain("test-client-secret");
  });

  it("rejects an unexpected response shape", async () => {
    token();
    fetchMock.mockResolvedValueOnce(json({ batch_header: {} }));

    const error = (await createPayout({ poId: "po-4", amount: 1, receiver: EMAIL }).catch(
      (e) => e,
    )) as PayPalError;
    expect(error.name).toBe("BAD_RESPONSE");
  });
});

describe("payout lookups", () => {
  it("reads batch status and item correlation", async () => {
    token();
    fetchMock.mockResolvedValueOnce(
      json({
        batch_header: { payout_batch_id: "B1", batch_status: "SUCCESS" },
        items: [
          {
            payout_item_id: "ITEM1",
            transaction_status: "FAILED",
            payout_item: { sender_item_id: "po-1" },
            errors: { name: "RECEIVER_UNREGISTERED", message: "Receiver is unregistered." },
          },
        ],
      }),
    );

    const batch = await getPayoutBatch("B1");

    expect(String(fetchMock.mock.calls[1][0])).toBe(`${BASE}/v1/payments/payouts/B1`);
    expect(batch).toEqual({
      batchId: "B1",
      status: "SUCCESS",
      items: [
        {
          itemId: "ITEM1",
          status: "FAILED",
          senderItemId: "po-1",
          errors: [{ name: "RECEIVER_UNREGISTERED", message: "Receiver is unregistered." }],
        },
      ],
    });
  });

  it("accepts payout item errors as an array", async () => {
    token();
    fetchMock.mockResolvedValueOnce(
      json({
        batch_header: { payout_batch_id: "B1", batch_status: "DENIED" },
        items: [
          {
            payout_item_id: "ITEM1",
            transaction_status: "FAILED",
            errors: [{ name: "INSUFFICIENT_FUNDS", message: "Not enough balance." }],
          },
        ],
      }),
    );

    const batch = await getPayoutBatch("B1");

    expect(batch.items[0].errors).toEqual([
      { name: "INSUFFICIENT_FUNDS", message: "Not enough balance." },
    ]);
  });

  it("reads a single payout item", async () => {
    token();
    fetchMock.mockResolvedValueOnce(
      json({
        payout_item_id: "ITEM1",
        transaction_status: "FAILED",
        payout_batch_id: "B1",
        payout_item: { sender_item_id: "po-1" },
      }),
    );

    const item = await getPayoutItem("ITEM1");

    expect(String(fetchMock.mock.calls[1][0])).toBe(`${BASE}/v1/payments/payouts-item/ITEM1`);
    expect(item).toEqual({ itemId: "ITEM1", status: "FAILED", senderItemId: "po-1", batchId: "B1" });
  });
});

describe("verifyWebhook", () => {
  it("verifies the signature and forwards the exact event", async () => {
    token();
    fetchMock.mockResolvedValueOnce(json({ verification_status: "SUCCESS" }));

    const event = { id: "WH-1", event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED" };
    await expect(verifyWebhook(WEBHOOK_HEADERS, event)).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${BASE}/v1/notifications/verify-webhook-signature`);
    expect(bodyOf(init)).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.paypal.com/cert.pem",
      transmission_id: "t-1",
      transmission_sig: "sig-1",
      transmission_time: "2026-11-10T00:00:00Z",
      webhook_id: "WH-TEST-1",
      webhook_event: event,
    });
  });

  it("returns false when PayPal rejects the signature", async () => {
    token();
    fetchMock.mockResolvedValueOnce(json({ verification_status: "FAILURE" }));

    await expect(verifyWebhook(WEBHOOK_HEADERS, {})).resolves.toBe(false);
  });

  it("returns false without calling PayPal when a header is missing", async () => {
    await expect(
      verifyWebhook({ ...WEBHOOK_HEADERS, "paypal-transmission-sig": undefined }, {}),
    ).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a Headers object", async () => {
    token();
    fetchMock.mockResolvedValueOnce(json({ verification_status: "SUCCESS" }));

    await expect(verifyWebhook(new Headers(WEBHOOK_HEADERS), { id: "WH-2" })).resolves.toBe(true);
  });
});
