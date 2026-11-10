import { weekSpent } from "@/lib/metrics";
import type { Repo } from "@/lib/repo";
import type {
  GuardDecision,
  GuardInput,
  Item,
  Mandate,
  MandateMode,
  POStatus,
  PurchaseOrder,
  Reason,
  Supplier,
  SupplierQuote,
} from "@/lib/types";

/** Shared executor types and pure helpers. No I/O in the mapping functions. */

const FAILED_PAYOUT_STATUSES = new Set([
  "FAILED",
  "BLOCKED",
  "RETURNED",
  "UNCLAIMED",
  "CANCELED",
  "CANCELLED",
  "REFUNDED",
  "REVERSED",
  "DENIED",
]);

export class ExecutorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExecutorError";
    this.code = code;
  }
}

export type PayoutClient = {
  createPayout(input: {
    poId: string;
    amount: number;
    receiver: string;
    note?: string;
  }): Promise<{ batchId: string; status: string }>;
  getPayoutBatch(batchId: string): Promise<{
    batchId: string;
    status: string;
    items: { itemId: string; status: string; senderItemId: string | null }[];
  }>;
};

export type ExecutorDeps = {
  repo: Repo;
  paypal: PayoutClient;
  receiver: string;
  clock?: () => Date;
};

export type ActionResult = {
  poId: string;
  status: POStatus;
  decision: GuardDecision | null;
  reasons: Reason[];
  batchId?: string;
  applied?: boolean;
};

export async function mustGetPO(repo: Repo, poId: string): Promise<PurchaseOrder> {
  const po = await repo.getPO(poId);
  if (!po) throw new ExecutorError("PO_NOT_FOUND", `Purchase order ${poId} does not exist.`);
  return po;
}

export function mapPayoutStatus(status: string): "paid" | "payment_failed" | null {
  const normalized = status.toUpperCase();
  if (normalized === "SUCCESS" || normalized === "COMPLETED") return "paid";
  if (FAILED_PAYOUT_STATUSES.has(normalized)) return "payment_failed";
  return null;
}

export function decideStatus(
  decision: GuardDecision,
  mode: MandateMode,
): "denied" | "pending_approval" | "approved" {
  if (decision === "deny") return "denied";
  if (decision === "escalate") return "pending_approval";
  return mode === "auto" ? "approved" : "pending_approval";
}

export function buildGuardInput(args: {
  po: PurchaseOrder;
  mandate: Mandate;
  suppliers: Supplier[];
  quotes: SupplierQuote[];
  items: Item[];
  pos: PurchaseOrder[];
  now: Date;
}): GuardInput {
  const { po, mandate, suppliers, quotes, items, pos, now } = args;

  const supplier =
    suppliers.find((candidate) => candidate.id === po.supplierId) ??
    { id: po.supplierId, approved: false };

  const quoteMap = new Map(
    quotes
      .filter((quote) => quote.supplierId === po.supplierId)
      .map((quote) => [
        quote.itemId,
        {
          unitPrice: quote.unitPrice,
          lastPaidPrice: quote.lastPaidPrice,
          moq: quote.moq,
        },
      ]),
  );

  return {
    po: {
      supplierId: po.supplierId,
      total: po.total,
      lines: (po.lines ?? []).map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        unitPrice: line.unitPrice,
      })),
    },
    mandate: {
      autoApproveCap: mandate.autoApproveCap,
      hardBlockCap: mandate.hardBlockCap,
      weeklyBudget: mandate.weeklyBudget,
      maxQtyMultiple: mandate.maxQtyMultiple,
      maxPriceSpikePct: mandate.maxPriceSpikePct,
    },
    supplier: { id: supplier.id, approved: supplier.approved },
    quotes: quoteMap,
    items: new Map(items.map((item) => [item.id, { avgDailyUse: item.avgDailyUse }])),
    weekSpent: weekSpent(pos, now),
    openPOs: pos
      .filter((candidate) => candidate.id !== po.id)
      .map((candidate) => ({
        supplierId: candidate.supplierId,
        itemIds: (candidate.lines ?? []).map((line) => line.itemId),
        status: candidate.status,
        createdAt: candidate.createdAt,
      })),
    now,
  };
}
