/**
 * Shared domain types. Code uses camelCase; the Supabase rows are snake_case and
 * are mapped in lib/repo.ts (T4). Money fields are numbers with up to 2 decimals.
 */

export type POStatus =
  | "drafted"
  | "pending_approval"
  | "approved"
  | "paying"
  | "paid"
  | "delivered"
  | "denied"
  | "rejected"
  | "payment_failed";

export type EventActor = "agent" | "guard" | "human" | "paypal" | "system";

export type MandateMode = "manual" | "auto";

export type Item = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  reorderPoint: number;
  avgDailyUse: number;
  createdAt?: Date;
};

export type Supplier = {
  id: string;
  name: string;
  approved: boolean;
  notes?: string | null;
};

export type SupplierQuote = {
  id: string;
  supplierId: string;
  itemId: string;
  unitPrice: number;
  lastPaidPrice: number | null;
  moq: number;
  leadDays: number;
};

export type Mandate = {
  id: number;
  mode: MandateMode;
  currency: string;
  weeklyBudget: number;
  autoApproveCap: number;
  hardBlockCap: number;
  maxQtyMultiple: number;
  maxPriceSpikePct: number;
  updatedAt?: Date;
};

export type POLine = {
  id?: string;
  poId?: string;
  itemId: string;
  qty: number;
  unitPrice: number;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  status: POStatus;
  total: number;
  currency: string;
  rationale: string | null;
  guardDecision: GuardDecision | null;
  guardReasons: Reason[];
  createdBy: string;
  payoutBatchId: string | null;
  payoutItemStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: POLine[];
};

export type Event = {
  id?: number;
  ts?: Date;
  actor: EventActor;
  type: string;
  poId?: string | null;
  detail: Record<string, unknown>;
};

/* ---- Spending mandate guard (see skill mandate-guard) ---- */

export type GuardDecision = "approve" | "escalate" | "deny";

export type ReasonSeverity = "deny" | "escalate";

export type Reason = {
  code: string;
  severity: ReasonSeverity;
  message: string;
};

export type GuardResult = {
  decision: GuardDecision;
  reasons: Reason[];
};

export type GuardInput = {
  po: {
    supplierId: string;
    total: number;
    lines: { itemId: string; qty: number; unitPrice: number }[];
  };
  mandate: {
    autoApproveCap: number;
    hardBlockCap: number;
    weeklyBudget: number;
    maxQtyMultiple: number;
    maxPriceSpikePct: number;
  };
  supplier: { id: string; approved: boolean };
  /** Keyed by itemId; only quotes from `supplier`. */
  quotes: Map<string, { unitPrice: number; lastPaidPrice: number | null; moq: number }>;
  /** Keyed by itemId. */
  items: Map<string, { avgDailyUse: number }>;
  /** Totals of approved|paying|paid|delivered POs created in the last 7 days. */
  weekSpent: number;
  openPOs: { supplierId: string; itemIds: string[]; status: string; createdAt: Date }[];
  now: Date;
};
