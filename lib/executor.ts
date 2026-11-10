import { createPayoutSteps } from "@/lib/executor.pay";
import {
  ExecutorError,
  buildGuardInput,
  decideStatus,
  mustGetPO,
  type ActionResult,
  type ExecutorDeps,
} from "@/lib/executor.shared";
import { evaluatePO } from "@/lib/guard";
import type { GuardResult, Mandate, PurchaseOrder } from "@/lib/types";

export { ExecutorError } from "@/lib/executor.shared";
export type { ActionResult, ExecutorDeps, PayoutClient } from "@/lib/executor.shared";

/**
 * Order lifecycle. The guard is authoritative: the agent only submits, a human
 * only approves what the guard allowed, and money moves exactly once.
 */
export function createExecutor(deps: ExecutorDeps) {
  const clock = deps.clock ?? (() => new Date());
  const { pay, syncPayout, applyPayoutEvent } = createPayoutSteps(deps);

  async function runGuard(po: PurchaseOrder): Promise<{ guard: GuardResult; mandate: Mandate }> {
    const [mandate, suppliers, quotes, items, pos] = await Promise.all([
      deps.repo.getMandate(),
      deps.repo.listSuppliers(),
      deps.repo.listQuotes(),
      deps.repo.listItems(),
      deps.repo.listPOs(),
    ]);

    const guard = evaluatePO(
      buildGuardInput({ po, mandate, suppliers, quotes, items, pos, now: clock() }),
    );
    return { guard, mandate };
  }

  async function recordGuard(poId: string, guard: GuardResult): Promise<void> {
    await deps.repo.setGuardResult(poId, guard.decision, guard.reasons);
    await deps.repo.insertEvent({
      actor: "guard",
      type: "guard_decision",
      poId,
      detail: {
        decision: guard.decision,
        reasons: guard.reasons.map((reason) => reason.code),
      },
    });
  }

  async function submitPO(poId: string): Promise<ActionResult> {
    const po = await mustGetPO(deps.repo, poId);
    if (po.status !== "drafted") {
      throw new ExecutorError(
        "INVALID_STATE",
        `Order is ${po.status}; only a drafted order can be submitted.`,
      );
    }

    const { guard, mandate } = await runGuard(po);
    await recordGuard(poId, guard);

    const target = decideStatus(guard.decision, mandate.mode);

    if (target === "denied") {
      await deps.repo.updatePOStatus(poId, "drafted", "denied");
      await deps.repo.insertEvent({
        actor: "system",
        type: "po_denied",
        poId,
        detail: { reasons: guard.reasons.map((reason) => reason.code) },
      });
      return { poId, status: "denied", decision: guard.decision, reasons: guard.reasons };
    }

    if (target === "pending_approval") {
      await deps.repo.updatePOStatus(poId, "drafted", "pending_approval");
      await deps.repo.insertEvent({
        actor: "system",
        type: guard.decision === "escalate" ? "po_escalated" : "po_awaiting_review",
        poId,
        detail: { reasons: guard.reasons.map((reason) => reason.code) },
      });
      return {
        poId,
        status: "pending_approval",
        decision: guard.decision,
        reasons: guard.reasons,
      };
    }

    const moved = await deps.repo.updatePOStatus(poId, "drafted", "approved");
    if (!moved) throw new ExecutorError("INVALID_STATE", "Order changed while submitting.");

    await deps.repo.insertEvent({
      actor: "system",
      type: "po_auto_approved",
      poId,
      detail: { total: po.total },
    });

    const paid = await pay(poId);
    return {
      poId,
      status: paid.status,
      decision: guard.decision,
      reasons: guard.reasons,
      batchId: paid.batchId,
    };
  }

  async function approvePO(poId: string): Promise<ActionResult> {
    const po = await mustGetPO(deps.repo, poId);
    if (po.status !== "pending_approval") {
      throw new ExecutorError(
        "INVALID_STATE",
        `Order is ${po.status}; only a pending order can be approved.`,
      );
    }

    // Re-run the guard: a human can approve an escalation, never a deny.
    const { guard } = await runGuard(po);
    await recordGuard(poId, guard);

    if (guard.decision === "deny") {
      await deps.repo.updatePOStatus(poId, "pending_approval", "denied");
      await deps.repo.insertEvent({
        actor: "human",
        type: "po_approve_blocked",
        poId,
        detail: { reasons: guard.reasons.map((reason) => reason.code) },
      });
      return { poId, status: "denied", decision: guard.decision, reasons: guard.reasons };
    }

    const moved = await deps.repo.updatePOStatus(poId, "pending_approval", "approved");
    if (!moved) throw new ExecutorError("INVALID_STATE", "Order changed while approving.");

    await deps.repo.insertEvent({
      actor: "human",
      type: "po_approved",
      poId,
      detail: { decision: guard.decision },
    });

    const paid = await pay(poId);
    return {
      poId,
      status: paid.status,
      decision: guard.decision,
      reasons: guard.reasons,
      batchId: paid.batchId,
    };
  }

  async function rejectPO(poId: string, reason?: string): Promise<ActionResult> {
    const moved = await deps.repo.updatePOStatus(poId, "pending_approval", "rejected");
    if (!moved) {
      const po = await mustGetPO(deps.repo, poId);
      throw new ExecutorError(
        "INVALID_STATE",
        `Order is ${po.status}; only a pending order can be rejected.`,
      );
    }

    const note = reason?.trim();
    await deps.repo.insertEvent({
      actor: "human",
      type: "po_rejected",
      poId,
      detail: note ? { reason: note } : {},
    });
    return { poId, status: "rejected", decision: null, reasons: [] };
  }

  async function markDelivered(poId: string): Promise<ActionResult> {
    const po = await mustGetPO(deps.repo, poId);
    if (po.status !== "paid") {
      throw new ExecutorError(
        "INVALID_STATE",
        `Order is ${po.status}; only a paid order can be delivered.`,
      );
    }

    // Claim the transition first, so a double click cannot add stock twice.
    const moved = await deps.repo.updatePOStatus(poId, "paid", "delivered");
    if (!moved) throw new ExecutorError("INVALID_STATE", "Order changed while delivering.");

    for (const line of po.lines ?? []) {
      await deps.repo.addStock(line.itemId, line.qty);
    }

    await deps.repo.insertEvent({
      actor: "human",
      type: "po_delivered",
      poId,
      detail: { lines: (po.lines ?? []).length },
    });
    return { poId, status: "delivered", decision: null, reasons: [] };
  }

  return { submitPO, approvePO, rejectPO, markDelivered, syncPayout, applyPayoutEvent };
}

export type Executor = ReturnType<typeof createExecutor>;
