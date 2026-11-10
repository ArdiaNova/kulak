import type {
  Event,
  EventActor,
  GuardDecision,
  Item,
  Mandate,
  MandateMode,
  POStatus,
  PurchaseOrder,
  Reason,
  Supplier,
  SupplierQuote,
} from "@/lib/types";

/**
 * Supabase row -> domain object mappers. Pure, so they can be unit tested:
 * Supabase returns snake_case columns and numeric/decimal columns as strings.
 */

export type Row = Record<string, unknown>;

export const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : Number(value ?? fallback);

export const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const nullableStr = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const nullableNum = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const asDate = (value: unknown): Date =>
  new Date(typeof value === "string" ? value : Date.now());

export const rows = (data: unknown): Row[] =>
  Array.isArray(data) ? (data as Row[]) : [];

export function toItem(row: Row): Item {
  return {
    id: str(row.id),
    sku: str(row.sku),
    name: str(row.name),
    unit: str(row.unit),
    stock: num(row.stock),
    reorderPoint: num(row.reorder_point),
    avgDailyUse: num(row.avg_daily_use),
    createdAt: asDate(row.created_at),
  };
}

export function toSupplier(row: Row): Supplier {
  return {
    id: str(row.id),
    name: str(row.name),
    approved: row.approved === true,
    notes: nullableStr(row.notes),
  };
}

export function toQuote(row: Row): SupplierQuote {
  return {
    id: str(row.id),
    supplierId: str(row.supplier_id),
    itemId: str(row.item_id),
    unitPrice: num(row.unit_price),
    lastPaidPrice: nullableNum(row.last_paid_price),
    moq: num(row.moq, 1),
    leadDays: num(row.lead_days),
  };
}

export function toMandate(row: Row): Mandate {
  return {
    id: num(row.id, 1),
    mode: (str(row.mode, "manual") as MandateMode) ?? "manual",
    currency: str(row.currency, "USD"),
    weeklyBudget: num(row.weekly_budget),
    autoApproveCap: num(row.auto_approve_cap),
    hardBlockCap: num(row.hard_block_cap),
    maxQtyMultiple: num(row.max_qty_multiple),
    maxPriceSpikePct: num(row.max_price_spike_pct),
    updatedAt: asDate(row.updated_at),
  };
}

export function toPO(row: Row, lines?: Row[]): PurchaseOrder {
  const nested = Array.isArray(row.po_lines) ? (row.po_lines as Row[]) : (lines ?? []);
  return {
    id: str(row.id),
    supplierId: str(row.supplier_id),
    status: str(row.status, "drafted") as POStatus,
    total: num(row.total),
    currency: str(row.currency, "USD"),
    rationale: nullableStr(row.rationale),
    guardDecision: nullableStr(row.guard_decision) as GuardDecision | null,
    guardReasons: Array.isArray(row.guard_reasons) ? (row.guard_reasons as Reason[]) : [],
    createdBy: str(row.created_by, "agent"),
    payoutBatchId: nullableStr(row.payout_batch_id),
    payoutItemStatus: nullableStr(row.payout_item_status),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    lines: nested.map((line) => ({
      id: str(line.id),
      poId: str(line.po_id),
      itemId: str(line.item_id),
      qty: num(line.qty),
      unitPrice: num(line.unit_price),
    })),
  };
}

export function toEvent(row: Row): Event {
  return {
    id: num(row.id),
    ts: asDate(row.ts),
    actor: str(row.actor, "system") as EventActor,
    type: str(row.type),
    poId: nullableStr(row.po_id),
    detail: (row.detail ?? {}) as Record<string, unknown>,
  };
}

export const PO_SELECT = "*, po_lines(*)";
