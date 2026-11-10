import { describe, expect, it } from "vitest";

import { createExecutor, type PayoutClient } from "@/lib/executor";
import { createFakeRepo, BEANS, BAD, GOOD, MILK } from "@/lib/fake-repo";
import { createPO } from "@/lib/po";
import type { Repo } from "@/lib/repo";

const NOW = new Date("2026-11-10T09:00:00.000Z");
const clock = () => NOW;
const RECEIVER = "supplier@example.com";

type PaypalOptions = { fail?: boolean; batchStatus?: string; itemStatus?: string };

function fakePaypal(options: PaypalOptions = {}) {
  const calls: { poId: string; amount: number; receiver: string }[] = [];

  const client: PayoutClient = {
    async createPayout(input) {
      calls.push({ poId: input.poId, amount: input.amount, receiver: input.receiver });
      if (options.fail) throw new Error("PayPal is down");
      return { batchId: "BATCH-1", status: "PENDING" };
    },
    async getPayoutBatch(batchId) {
      return {
        batchId,
        status: options.batchStatus ?? "SUCCESS",
        items: [
          {
            itemId: "ITEM-1",
            status: options.itemStatus ?? "SUCCESS",
            senderItemId: null,
          },
        ],
      };
    },
  };

  return { client, calls };
}

async function setup(options: { mode?: "manual" | "auto"; paypal?: PaypalOptions } = {}) {
  const { state, repo } = createFakeRepo({ clock });
  if (options.mode) await repo.updateMandate({ mode: options.mode }, NOW);

  const paypal = fakePaypal(options.paypal);
  const executor = createExecutor({
    repo,
    paypal: paypal.client,
    receiver: RECEIVER,
    clock,
  });

  return { state, repo, paypal, executor };
}

function draft(
  repo: Repo,
  input: { supplierId?: string; itemId?: string; qty: number },
) {
  return createPO(repo, {
    supplierId: input.supplierId ?? GOOD,
    lines: [{ itemId: input.itemId ?? MILK, qty: input.qty }],
    rationale: "Restock for the coming week.",
    createdBy: "agent",
  });
}

describe("submitPO", () => {
  it("holds a guard-approved manual order for review and pays nothing", async () => {
    const { repo, paypal, executor } = await setup();
    const po = await draft(repo, { qty: 20 }); // 20 * 1.15 = 23.00

    const result = await executor.submitPO(po.id);

    expect(result).toMatchObject({ status: "pending_approval", decision: "approve" });
    expect(paypal.calls).toHaveLength(0);

    const stored = await repo.getPO(po.id);
    expect(stored).toMatchObject({ status: "pending_approval", guardDecision: "approve" });

    const types = (await repo.listEvents(20)).map((event) => event.type);
    expect(types).toContain("guard_decision");
    expect(types).toContain("po_awaiting_review");
  });

  it("pays a guard-approved auto order exactly once, for the server-side total", async () => {
    const { repo, paypal, executor } = await setup({ mode: "auto" });
    const po = await draft(repo, { qty: 20 });

    const result = await executor.submitPO(po.id);

    expect(result).toMatchObject({ status: "paying", batchId: "BATCH-1" });
    expect(paypal.calls).toEqual([{ poId: po.id, amount: 23, receiver: RECEIVER }]);

    const stored = await repo.getPO(po.id);
    expect(stored).toMatchObject({ status: "paying", payoutBatchId: "BATCH-1" });

    const types = (await repo.listEvents(30)).map((event) => event.type);
    expect(types).toEqual(
      expect.arrayContaining(["guard_decision", "po_auto_approved", "payout_started", "payout_created"]),
    );
  });

  it("denies a rogue order and never calls PayPal", async () => {
    const { repo, paypal, executor } = await setup(); // manual mode: deny must still win
    const po = await draft(repo, { supplierId: BAD, itemId: BEANS, qty: 40 }); // 448.00

    const result = await executor.submitPO(po.id);

    expect(result.status).toBe("denied");
    expect(result.decision).toBe("deny");
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["SUPPLIER_NOT_APPROVED", "QTY_UNUSUAL"]),
    );
    expect(paypal.calls).toHaveLength(0);
    expect((await repo.getPO(po.id))?.status).toBe("denied");
  });

  it("escalates an over-cap order and only pays after a human approves", async () => {
    const { repo, paypal, executor } = await setup({ mode: "auto" });
    const po = await draft(repo, { itemId: BEANS, qty: 10 }); // 145.00, +20.8% price spike

    const submitted = await executor.submitPO(po.id);
    expect(submitted).toMatchObject({ status: "pending_approval", decision: "escalate" });
    expect(submitted.reasons.map((reason) => reason.code)).toContain("PRICE_SPIKE");
    expect(paypal.calls).toHaveLength(0);

    const approved = await executor.approvePO(po.id);
    expect(approved).toMatchObject({ status: "paying", batchId: "BATCH-1" });
    expect(paypal.calls).toEqual([{ poId: po.id, amount: 145, receiver: RECEIVER }]);
  });

  it("refuses to submit an order that is no longer drafted", async () => {
    const { repo, executor } = await setup();
    const po = await draft(repo, { qty: 20 });
    await executor.submitPO(po.id);

    await expect(executor.submitPO(po.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("maps a PayPal error to payment_failed and writes an event", async () => {
    const { repo, executor } = await setup({
      mode: "auto",
      paypal: { fail: true },
    });
    const po = await draft(repo, { qty: 20 });

    const result = await executor.submitPO(po.id);

    expect(result.status).toBe("payment_failed");
    expect(result.batchId).toBeUndefined();
    expect((await repo.getPO(po.id))?.status).toBe("payment_failed");

    const failed = (await repo.listEvents(30)).find((event) => event.type === "payout_failed");
    expect(failed).toMatchObject({ actor: "paypal", poId: po.id });
  });
});

describe("approvePO", () => {
  it("pays a pending order and refuses the second approval", async () => {
    const { repo, paypal, executor } = await setup();
    const po = await draft(repo, { qty: 20 });
    await executor.submitPO(po.id);

    const first = await executor.approvePO(po.id);
    expect(first.status).toBe("paying");

    await expect(executor.approvePO(po.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(paypal.calls).toHaveLength(1);
  });

  it("cannot override a guard deny, even when the order is already pending", async () => {
    const { state, repo, paypal, executor } = await setup();
    const po = await draft(repo, { itemId: BEANS, qty: 10 });
    await executor.submitPO(po.id); // escalated, pending a human

    const supplier = state.suppliers.find((candidate) => candidate.id === GOOD);
    if (!supplier) throw new Error("seed supplier missing");
    supplier.approved = false;

    const result = await executor.approvePO(po.id);

    expect(result.status).toBe("denied");
    expect(result.reasons.map((reason) => reason.code)).toContain("SUPPLIER_NOT_APPROVED");
    expect(paypal.calls).toHaveLength(0);
    expect((await repo.getPO(po.id))?.status).toBe("denied");
  });
});

describe("rejectPO", () => {
  it("rejects a pending order and the order can no longer be approved", async () => {
    const { repo, paypal, executor } = await setup();
    const po = await draft(repo, { qty: 20 });
    await executor.submitPO(po.id);

    const result = await executor.rejectPO(po.id);
    expect(result.status).toBe("rejected");
    expect((await repo.getPO(po.id))?.status).toBe("rejected");

    await expect(executor.approvePO(po.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(paypal.calls).toHaveLength(0);
  });
});

describe("syncPayout", () => {
  async function paidOrder(paypal: PaypalOptions = {}) {
    const ctx = await setup({ mode: "auto", paypal });
    const po = await draft(ctx.repo, { qty: 20 });
    await ctx.executor.submitPO(po.id);
    return { ...ctx, po };
  }

  it("applies SUCCESS once and then leaves a paid order alone", async () => {
    const { repo, executor, po } = await paidOrder();

    const first = await executor.syncPayout(po.id);
    expect(first).toMatchObject({ status: "paid", applied: true });

    const second = await executor.syncPayout(po.id);
    expect(second).toMatchObject({ status: "paid", applied: false });
  });

  it("keeps the order paying while PayPal reports PENDING", async () => {
    const { repo, executor, po } = await paidOrder({ itemStatus: "PENDING", batchStatus: "PENDING" });

    const result = await executor.syncPayout(po.id);

    expect(result).toMatchObject({ status: "paying", applied: false });
    expect((await repo.getPO(po.id))?.status).toBe("paying");
  });

  it("maps a failed payout item to payment_failed", async () => {
    const { repo, executor, po } = await paidOrder({ itemStatus: "UNCLAIMED" });

    const result = await executor.syncPayout(po.id);

    expect(result).toMatchObject({ status: "payment_failed", applied: true });
    expect((await repo.getPO(po.id))?.status).toBe("payment_failed");
  });

  it("refuses to sync an order without a payout batch", async () => {
    const { repo, executor } = await setup();
    const po = await draft(repo, { qty: 20 });

    await expect(executor.syncPayout(po.id)).rejects.toMatchObject({ code: "NO_PAYOUT" });
  });
});

describe("markDelivered", () => {
  it("adds stock once and only for a paid order", async () => {
    const { state, repo, executor } = await setup({ mode: "auto" });
    const po = await draft(repo, { qty: 20 });
    await executor.submitPO(po.id);
    await executor.syncPayout(po.id);

    const before = state.items.find((item) => item.id === MILK)?.stock ?? 0;
    const result = await executor.markDelivered(po.id);
    expect(result.status).toBe("delivered");

    const after = state.items.find((item) => item.id === MILK)?.stock ?? 0;
    expect(after).toBe(before + 20);
    expect((await repo.getPO(po.id))?.status).toBe("delivered");

    await expect(executor.markDelivered(po.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(state.items.find((item) => item.id === MILK)?.stock).toBe(after);
  });

  it("refuses an order that has not been paid", async () => {
    const { repo, executor } = await setup();
    const po = await draft(repo, { qty: 20 });
    await executor.submitPO(po.id);

    await expect(executor.markDelivered(po.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
