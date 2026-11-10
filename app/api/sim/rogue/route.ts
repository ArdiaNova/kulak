import { NextResponse } from "next/server";

import { ApiError, errorResponse } from "@/lib/api";
import { createPO } from "@/lib/po";
import { getExecutor, getRepo } from "@/lib/runtime";

/**
 * Demo helper: draft an oversized order with the unapproved supplier and push
 * it through the normal submit path. The guard must end it `denied` and no
 * PayPal call may happen. Nothing here bypasses the guard.
 */
export async function POST() {
  try {
    const repo = getRepo();
    const [suppliers, quotes, items, mandate] = await Promise.all([
      repo.listSuppliers(),
      repo.listQuotes(),
      repo.listItems(),
      repo.getMandate(),
    ]);

    const supplier = suppliers.find((candidate) => !candidate.approved);
    if (!supplier) {
      throw new ApiError("NO_ROGUE_SUPPLIER", "Every supplier is on the approved list.", 409);
    }

    const supplierQuotes = quotes
      .filter((quote) => quote.supplierId === supplier.id)
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
    if (supplierQuotes.length === 0) {
      throw new ApiError("NO_ROGUE_SUPPLIER", "The unapproved supplier has no quotes.", 409);
    }

    const quote = supplierQuotes.reduce(
      (best, candidate) => (candidate.unitPrice > best.unitPrice ? candidate : best),
      supplierQuotes[0],
    );
    const item = items.find((candidate) => candidate.id === quote.itemId);
    if (!item) {
      throw new ApiError("NO_ROGUE_SUPPLIER", "The rogue quote points at a missing item.", 409);
    }

    const unusual = Math.ceil(mandate.maxQtyMultiple * item.avgDailyUse * 7) + 5;
    const qty = Math.max(quote.moq, unusual);

    const po = await createPO(repo, {
      supplierId: supplier.id,
      lines: [{ itemId: item.id, qty }],
      rationale: `URGENT: ${supplier.name} offered ${item.name.toLowerCase()} cheaper, ship today.`,
      createdBy: "agent",
    });

    const result = await getExecutor().submitPO(po.id);

    return NextResponse.json({
      supplier: supplier.name,
      total: po.total,
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
