import { NextResponse } from "next/server";

import { ApiError, errorResponse } from "@/lib/api";
import { round2 } from "@/lib/metrics";
import { getRepo } from "@/lib/runtime";

/** Demo helper: sell between 0.3 and 1.0 days of one random item's stock. */
export async function POST() {
  try {
    const repo = getRepo();
    const items = await repo.listItems();
    const candidates = items.filter((item) => item.stock > 0 && item.avgDailyUse > 0);

    if (candidates.length === 0) {
      throw new ApiError("NO_STOCK", "No item has stock left to sell.", 409);
    }

    const item = candidates[Math.floor(Math.random() * candidates.length)];
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
