import { round2 } from "@/lib/metrics";
import type { Repo } from "@/lib/repo";
import type { PurchaseOrder } from "@/lib/types";

export class POError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "POError";
    this.code = code;
  }
}

/**
 * Create a draft PO. Unit prices and the total come from supplier_quotes only;
 * the caller (agent or API) supplies items and quantities, never prices.
 */
export async function createPO(
  repo: Repo,
  input: {
    supplierId: string;
    lines: { itemId: string; qty: number }[];
    rationale: string;
    createdBy: string;
  },
): Promise<PurchaseOrder> {
  if (input.lines.length === 0) {
    throw new POError("EMPTY_PO", "A purchase order needs at least one line.");
  }

  const rationale = input.rationale.trim();
  if (rationale.length === 0) {
    throw new POError("MISSING_RATIONALE", "A purchase order needs a one-sentence rationale.");
  }
  if (rationale.length > 300) {
    throw new POError("RATIONALE_TOO_LONG", "Rationale must be 300 characters or fewer.");
  }

  const [suppliers, quotes] = await Promise.all([repo.listSuppliers(), repo.listQuotes()]);

  if (!suppliers.some((supplier) => supplier.id === input.supplierId)) {
    throw new POError("SUPPLIER_NOT_FOUND", "Unknown supplier.");
  }

  const priceByItem = new Map(
    quotes
      .filter((quote) => quote.supplierId === input.supplierId)
      .map((quote) => [quote.itemId, quote.unitPrice]),
  );

  const lines = input.lines.map((line) => {
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      throw new POError("INVALID_QTY", "Quantity must be greater than zero.");
    }
    const unitPrice = priceByItem.get(line.itemId);
    if (unitPrice === undefined) {
      throw new POError(
        "ITEM_NOT_QUOTED",
        "The selected supplier has no quote for one of the items.",
      );
    }
    return { itemId: line.itemId, qty: line.qty, unitPrice };
  });

  const total = round2(
    lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
  );

  const po = await repo.insertPO({
    supplierId: input.supplierId,
    lines,
    total,
    currency: "USD",
    rationale,
    createdBy: input.createdBy,
  });

  await repo.insertEvent({
    actor: input.createdBy === "agent" ? "agent" : "human",
    type: "po_created",
    poId: po.id,
    detail: { supplierId: po.supplierId, total: po.total, lines: lines.length },
  });

  return po;
}
