import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorResponse } from "@/lib/api";
import { round2 } from "@/lib/metrics";
import { createPO } from "@/lib/po";
import { getExecutor, getRepo } from "@/lib/runtime";

/**
 * Owner-initiated order. Same path as an agent order: prices and the total come
 * from supplier_quotes, then lib/guard.ts decides. A human placing the order is
 * the approval intent, so in manual mode an order the guard approves is paid
 * without a second click; anything escalated still waits in the inbox.
 */

const orderSchema = z.object({
  supplierId: z.string().min(1),
  itemId: z.string().min(1),
  qty: z.number().positive().max(10_000),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError("INVALID_ORDER", "Pick an item, a supplier and a quantity.", 400);
    }

    const { supplierId, itemId } = parsed.data;
    const qty = round2(parsed.data.qty);

    const repo = getRepo();
    const [suppliers, items, quotes] = await Promise.all([
      repo.listSuppliers(),
      repo.listItems(),
      repo.listQuotes(),
    ]);

    const supplier = suppliers.find((candidate) => candidate.id === supplierId);
    if (!supplier) throw new ApiError("SUPPLIER_NOT_FOUND", "Unknown supplier.", 404);

    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) throw new ApiError("ITEM_NOT_FOUND", "Unknown item.", 404);

    const quoted = quotes.some(
      (quote) => quote.supplierId === supplierId && quote.itemId === itemId,
    );
    if (!quoted) {
      throw new ApiError("ITEM_NOT_QUOTED", "That supplier does not quote this item.", 409);
    }

    const po = await createPO(repo, {
      supplierId,
      lines: [{ itemId, qty }],
      rationale: `Owner order: ${qty} ${item.unit} of ${item.name} from ${supplier.name}.`.slice(
        0,
        300,
      ),
      createdBy: "human",
    });

    const executor = getExecutor();
    const submitted = await executor.submitPO(po.id);

    // The owner already decided to buy this. In manual mode the guard's
    // "approve" would park it in their own inbox, so pay it now. Escalations
    // (over the auto-approve cap) still wait for an explicit second click.
    const result =
      submitted.status === "pending_approval" && submitted.decision === "approve"
        ? await executor.approvePO(po.id)
        : submitted;

    return NextResponse.json({
      ...result,
      supplier: supplier.name,
      supplierApproved: supplier.approved,
      total: po.total,
      qty,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
