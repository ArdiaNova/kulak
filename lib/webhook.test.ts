import { describe, expect, it, vi } from "vitest";

import { createExecutor, type PayoutClient } from "@/lib/executor";
import { BEANS, GOOD, createFakeRepo } from "@/lib/fake-repo";
import type { PurchaseOrder } from "@/lib/types";
import { handleWebhook, targetStatusFor } from "@/lib/webhook";

const NOW = new Date("2026-11-10T09:00:00.000Z");

function payingPO(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "po-1",
    supplierId: GOOD,
    status: "paying",
    total: 23,
    currency: "USD",
    rationale: "Milk runs out tomorrow.",
    guardDecision: "approve",
    guardReasons: [],
    createdBy: "agent",
    payoutBatchId: "BATCH-1",
    payoutItemStatus: "PENDING",
    createdAt: NOW,
    updatedAt: NOW,
    lines: [{ itemId: BEANS, qty: 2, unitPrice: 11.5 }],
    ...over,
  };
}

function itemEvent(eventType: string, id = "evt-1"): string {
  return JSON.stringify({
    id,
    event_type: eventType,
    resource: { payout_item_id: "ITEM-1", transaction_status: "SUCCESS", payout_batch_id: "BATCH-1" },
  });
}

function setup(options: {
  verified?: boolean;
  item?: { status: string; senderItemId: string | null } | Error;
  pos?: PurchaseOrder[];
} = {}) {
  const { repo, state } = createFakeRepo({ seed: { pos: options.pos ?? [payingPO()] } });
  const paypal: PayoutClient = {
    async createPayout() {
      throw new Error("PayPal payout must not be called from a webhook");
    },
    async getPayoutBatch() {
      throw new Error("PayPal batch must not be called from a webhook");
    },
  };
  const executor = createExecutor({ repo, paypal, receiver: "supplier@example.com", clock: () => NOW });
  const getItem = vi.fn(async () => {
    if (options.item instanceof Error) throw options.item;
    return options.item ?? { status: "SUCCESS", senderItemId: "po-1" };
  });

  return {
    state,
    repo,
    getItem,
    deps: {
      repo,
      executor,
      verify: async () => options.verified ?? true,
      getItem,
      skipVerify: false,
    },
  };
}

describe("targetStatusFor", () => {
  it("maps item events to the PO status they imply", () => {
    expect(targetStatusFor("PAYMENT.PAYOUTS-ITEM.SUCCEEDED")).toBe("paid");
    expect(targetStatusFor("PAYMENT.PAYOUTS-ITEM.FAILED")).toBe("payment_failed");
    expect(targetStatusFor("PAYMENT.PAYOUTS-ITEM.BLOCKED")).toBe("payment_failed");
    expect(targetStatusFor("PAYMENT.PAYOUTS-ITEM.HELD")).toBeNull();
    expect(targetStatusFor("PAYMENT.PAYOUTSBATCH.SUCCESS")).toBeNull();
  });
});

describe("handleWebhook", () => {
  it("marks the order paid when PayPal says the item succeeded", async () => {
    const { deps, repo, state } = setup();

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), {}, deps);

    expect(outcome).toMatchObject({ status: 200, body: { action: "applied:paid" } });
    expect(state.pos[0].status).toBe("paid");
    const events = await repo.listEvents(100);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["payout_event", "webhook_received"]),
    );
    expect(events.find((event) => event.type === "payout_event")).toMatchObject({
      actor: "paypal",
      poId: "po-1",
      detail: { applied: true, to: "paid" },
    });
  });

  it("ignores a replay: the status is already the target", async () => {
    const { deps, repo, state } = setup({ pos: [payingPO({ status: "paid" })] });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), {}, deps);

    expect(outcome).toMatchObject({ status: 200, body: { action: "no_change" } });
    expect(state.pos[0].status).toBe("paid");
    const event = (await repo.listEvents(100)).find((row) => row.type === "payout_event");
    expect(event?.detail).toMatchObject({ duplicate: true, applied: null });
  });

  it("moves the order to payment_failed when the item fails", async () => {
    const { deps, state } = setup({ item: { status: "FAILED", senderItemId: "po-1" } });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.FAILED"), {}, deps);

    expect(outcome).toMatchObject({ status: 200, body: { action: "applied:payment_failed" } });
    expect(state.pos[0].status).toBe("payment_failed");
  });

  it("logs an unknown purchase order and still answers 200", async () => {
    const { deps, repo, state } = setup({ item: { status: "SUCCESS", senderItemId: "po-gone" } });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), {}, deps);

    expect(outcome).toMatchObject({ status: 200, body: { action: "unknown_po" } });
    expect(state.pos[0].status).toBe("paying");
    expect((await repo.listEvents(100)).map((event) => event.type)).toContain("webhook_unknown_po");
  });

  it("rejects a bad signature with 400 and never calls PayPal", async () => {
    const { deps, repo, getItem, state } = setup({ verified: false });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), {}, deps);

    expect(outcome).toMatchObject({ status: 400, body: { action: "bad_signature" } });
    expect(getItem).not.toHaveBeenCalled();
    expect(state.pos[0].status).toBe("paying");
    expect((await repo.listEvents(100)).map((event) => event.type)).toContain("webhook_rejected");
  });

  it("ignores an event type we do not handle", async () => {
    const { deps, repo } = setup();

    const outcome = await handleWebhook(
      JSON.stringify({ event_type: "CATALOG.PRODUCT.UPDATED", resource: {} }),
      {},
      deps,
    );

    expect(outcome).toMatchObject({ status: 200, body: { action: "ignored" } });
    expect((await repo.listEvents(100)).map((event) => event.type)).toContain("webhook_ignored");
  });

  it("keeps a held item in paying and only writes an event", async () => {
    const { deps, state } = setup({ item: { status: "HELD", senderItemId: "po-1" } });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.HELD"), {}, deps);

    expect(outcome).toMatchObject({ status: 200, body: { action: "no_change" } });
    expect(state.pos[0].status).toBe("paying");
  });

  it("does not settle an order from a batch event, which carries no item", async () => {
    const { deps, repo, getItem, state } = setup();

    const outcome = await handleWebhook(
      JSON.stringify({ event_type: "PAYMENT.PAYOUTSBATCH.PROCESSING", resource: { payout_batch_id: "BATCH-1" } }),
      {},
      deps,
    );

    expect(outcome).toMatchObject({ status: 200, body: { action: "batch_logged" } });
    expect(getItem).not.toHaveBeenCalled();
    expect(state.pos[0].status).toBe("paying");
    const events = await repo.listEvents(100);
    const logged = events.find((event) => event.type === "webhook_received");
    expect(logged?.detail).toMatchObject({
      eventType: "PAYMENT.PAYOUTSBATCH.PROCESSING",
      payload: {
        event_type: "PAYMENT.PAYOUTSBATCH.PROCESSING",
        resource: { payout_batch_id: "BATCH-1" },
      },
    });
  });

  it("asks PayPal to retry when the item lookup fails", async () => {
    const { deps, repo } = setup({ item: new Error("boom") });

    const outcome = await handleWebhook(itemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), {}, deps);

    expect(outcome).toMatchObject({ status: 502, body: { action: "item_lookup_failed" } });
    expect((await repo.listEvents(100)).map((event) => event.type)).toContain("webhook_error");
  });

  it("rejects a body that is not JSON", async () => {
    const { deps } = setup();

    const outcome = await handleWebhook("not json", {}, deps);

    expect(outcome).toMatchObject({ status: 400, body: { action: "invalid_json" } });
  });
});
