import {
  ExecutorError,
  mapPayoutStatus,
  mustGetPO,
  type ActionResult,
  type ExecutorDeps,
} from "@/lib/executor.shared";
import type { POStatus } from "@/lib/types";

/**
 * The money steps: start a payout and reconcile it later. `pay` claims the
 * `approved -> paying` transition before calling PayPal, so a retry or a double
 * click cannot send two payouts.
 */
export function createPayoutSteps(deps: ExecutorDeps) {
  async function pay(poId: string): Promise<{ status: POStatus; batchId?: string }> {
    // Conditional update first: two concurrent approvals cannot both reach PayPal.
    const moved = await deps.repo.updatePOStatus(poId, "approved", "paying");
    if (!moved) {
      const current = await deps.repo.getPO(poId);
      return { status: current?.status ?? "approved" };
    }

    const po = await mustGetPO(deps.repo, poId);
    await deps.repo.insertEvent({
      actor: "system",
      type: "payout_started",
      poId,
      detail: { amount: po.total, senderBatchId: `kulak-${poId}` },
    });

    try {
      const payout = await deps.paypal.createPayout({
        poId,
        amount: po.total,
        receiver: deps.receiver,
        note: `Kulak PO ${poId.slice(0, 8)}`,
      });
      await deps.repo.setPayout(poId, { batchId: payout.batchId, itemStatus: payout.status });
      await deps.repo.insertEvent({
        actor: "paypal",
        type: "payout_created",
        poId,
        detail: { batchId: payout.batchId, status: payout.status },
      });
      return { status: "paying", batchId: payout.batchId };
    } catch (error) {
      const name = error instanceof Error ? error.name : "UNKNOWN";
      const debugId =
        typeof (error as { debugId?: unknown }).debugId === "string"
          ? (error as { debugId: string }).debugId
          : null;

      await deps.repo.updatePOStatus(poId, "paying", "payment_failed");
      await deps.repo.insertEvent({
        actor: "paypal",
        type: "payout_failed",
        poId,
        detail: { name, debugId },
      });
      return { status: "payment_failed" };
    }
  }

  async function syncPayout(poId: string): Promise<ActionResult> {    const po = await mustGetPO(deps.repo, poId);
    if (!po.payoutBatchId) {
      throw new ExecutorError("NO_PAYOUT", "This order has no payout batch yet.");
    }
    if (po.status !== "paying") {
      return { poId, status: po.status, decision: null, reasons: [], applied: false };
    }

    const batch = await deps.paypal.getPayoutBatch(po.payoutBatchId);
    const item =
      batch.items.find((candidate) => candidate.senderItemId === poId) ?? batch.items[0];
    const batchFailed = batch.status.toUpperCase() === "DENIED";
    const target =
      mapPayoutStatus(item?.status ?? "") ?? (batchFailed ? "payment_failed" : null);

    if (!target) {
      await deps.repo.insertEvent({
        actor: "paypal",
        type: "payout_synced",
        poId,
        detail: { batchStatus: batch.status, itemStatus: item?.status ?? null, applied: null },
      });
      return { poId, status: "paying", decision: null, reasons: [], applied: false };
    }

    const moved = await deps.repo.updatePOStatus(poId, "paying", target);
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "payout_synced",
      poId,
      detail: {
        batchStatus: batch.status,
        itemStatus: item?.status ?? null,
        applied: target,
        changed: moved,
      },
    });

    return { poId, status: target, decision: null, reasons: [], applied: moved };
  }

  /**
   * Apply a webhook's verdict to the order it belongs to. Idempotent: a replay,
   * or an order that already sits in the target status, changes nothing.
   */
  async function applyPayoutEvent(input: {
    poId: string;
    target: "paid" | "payment_failed" | null;
    detail: Record<string, unknown>;
  }): Promise<{ poId: string; status: POStatus; changed: boolean }> {
    const po = await mustGetPO(deps.repo, input.poId);

    if (!input.target) {
      await deps.repo.insertEvent({
        actor: "paypal",
        type: "payout_event",
        poId: po.id,
        detail: { ...input.detail, applied: null },
      });
      return { poId: po.id, status: po.status, changed: false };
    }

    // Same status already: nothing to do, but keep the audit trail.
    if (po.status === input.target) {
      await deps.repo.insertEvent({
        actor: "paypal",
        type: "payout_event",
        poId: po.id,
        detail: { ...input.detail, applied: null, duplicate: true },
      });
      return { poId: po.id, status: po.status, changed: false };
    }

    // Only an in-flight payout can be settled; otherwise the event is logged only.
    const moved = await deps.repo.updatePOStatus(po.id, "paying", input.target);
    await deps.repo.insertEvent({
      actor: "paypal",
      type: "payout_event",
      poId: po.id,
      detail: { ...input.detail, from: po.status, to: input.target, applied: moved },
    });

    return { poId: po.id, status: moved ? input.target : po.status, changed: moved };
  }

  return { pay, syncPayout, applyPayoutEvent };
}
