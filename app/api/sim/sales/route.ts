import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorResponse } from "@/lib/api";
import { round2 } from "@/lib/metrics";
import { getRepo } from "@/lib/runtime";

/**
 * Demo helper: sell between 0.3 and 1.0 days of one item's stock. Pass an
 * itemId to sell that item (a judge may know about a booking the model cannot
 * see); omit it and the item is random.
 */

const salesSchema = z.object({
  itemId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = salesSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new ApiError("INVALID_SALE", "itemId must be a non-empty string.", 400);
    }

    const repo = getRepo();
    const items = await repo.listItems();

    const candidates = items.filter((item) => item.stock > 0 && item.avgDailyUse > 0);
    if (candidates.length === 0) {
      throw new ApiError("NO_STOCK", "No item has stock left to sell.", 409);
    }

    const item = parsed.data.itemId
      ? candidates.find((candidate) => candidate.id === parsed.data.itemId)
      : candidates[Math.floor(Math.random() * candidates.length)];

    if (!item) {
      throw new ApiError(
        "NO_STOCK",
        "That item has no stock to sell or no daily use recorded.",
        409,
      );
    }

    const sold = round2(Math.min(item.stock, item.avgDailyUse * (0.3 + Math.random() * 0.7)));

    await repo.addStock(item.id, -sold);
    await repo.insertEvent({
      actor: "system",
      type: "stock_sold",
      detail: { itemId: item.id, sku: item.sku, qty: sold },
    });

    return NextResponse.json({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      sold,
      stock: round2(item.stock - sold),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
