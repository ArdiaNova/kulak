import type {
  Event,
  GuardDecision,
  Item,
  Mandate,
  POStatus,
  PurchaseOrder,
  Reason,
  Supplier,
  SupplierQuote,
} from "@/lib/types";

/**
 * Data access boundary. Everything above it (executor, routes) depends only on
 * this interface, so tests can drop in an in-memory fake repo.
 */

export type MandatePatch = Partial<
  Pick<
    Mandate,
    | "mode"
    | "weeklyBudget"
    | "autoApproveCap"
    | "hardBlockCap"
    | "maxQtyMultiple"
    | "maxPriceSpikePct"
  >
>;

export type NewPO = {
  supplierId: string;
  lines: { itemId: string; qty: number; unitPrice: number }[];
  total: number;
  currency: string;
  rationale: string;
  createdBy: string;
};

export type PayoutUpdate = {
  batchId: string;
  itemStatus?: string | null;
};

export interface Repo {
  getMandate(): Promise<Mandate>;
  updateMandate(patch: MandatePatch, now: Date): Promise<Mandate>;

  listItems(): Promise<Item[]>;
  listSuppliers(): Promise<Supplier[]>;
  listQuotes(): Promise<SupplierQuote[]>;

  listPOs(): Promise<PurchaseOrder[]>;
  getPO(id: string): Promise<PurchaseOrder | null>;
  insertPO(po: NewPO): Promise<PurchaseOrder>;

  /** Atomic conditional update: only touches rows whose status is in `from`. */
  updatePOStatus(id: string, from: POStatus | POStatus[], to: POStatus): Promise<boolean>;

  setGuardResult(id: string, decision: GuardDecision, reasons: Reason[]): Promise<void>;
  setPayout(id: string, payout: PayoutUpdate): Promise<void>;
  addStock(itemId: string, delta: number): Promise<void>;

  insertEvent(event: Event): Promise<void>;
  listEvents(limit: number): Promise<Event[]>;

  /** Same effect as supabase/reset.sql. */
  resetDemo(now: Date): Promise<void>;
}
