import type { Item, POStatus, PurchaseOrder } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Statuses that block a duplicate order for the same supplier and item. */
export const OPEN_PO_STATUSES: POStatus[] = [
  "pending_approval",
  "approved",
  "paying",
  "paid",
];

/** Statuses that count towards the weekly budget. */
export const WEEK_SPEND_STATUSES: POStatus[] = [
  "approved",
  "paying",
  "paid",
  "delivered",
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Days of stock left, one decimal. `null` when the item has no daily use. */
export function daysLeft(item: Pick<Item, "stock" | "avgDailyUse">): number | null {
  if (item.avgDailyUse <= 0) return null;
  return Math.round((item.stock / item.avgDailyUse) * 10) / 10;
}

export function weekSpent(pos: PurchaseOrder[], now: Date): number {
  const total = pos
    .filter(
      (po) =>
        WEEK_SPEND_STATUSES.includes(po.status) &&
        now.getTime() - po.createdAt.getTime() <= WEEK_MS,
    )
    .reduce((sum, po) => sum + po.total, 0);
  return round2(total);
}
