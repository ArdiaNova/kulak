import type { MandatePatch } from "@/lib/repo";

/**
 * Mandate helpers shared by the Supabase repo and its tests. Pure: no I/O, so
 * the camelCase -> snake_case mapping can be unit tested without a database.
 */

/** Same values as supabase/reset.sql and the schema defaults. */
export const DEFAULT_MANDATE: MandatePatch = {
  mode: "manual",
  weeklyBudget: 600,
  autoApproveCap: 200,
  hardBlockCap: 600,
  maxQtyMultiple: 2.5,
  maxPriceSpikePct: 20,
};

/** camelCase patch -> snake_case columns. Undefined fields are left alone. */
export function mandateColumns(patch: MandatePatch): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (patch.mode !== undefined) update.mode = patch.mode;
  if (patch.weeklyBudget !== undefined) update.weekly_budget = patch.weeklyBudget;
  if (patch.autoApproveCap !== undefined) update.auto_approve_cap = patch.autoApproveCap;
  if (patch.hardBlockCap !== undefined) update.hard_block_cap = patch.hardBlockCap;
  if (patch.maxQtyMultiple !== undefined) update.max_qty_multiple = patch.maxQtyMultiple;
  if (patch.maxPriceSpikePct !== undefined) update.max_price_spike_pct = patch.maxPriceSpikePct;
  return update;
}
