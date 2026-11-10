import type {
  Event as DomainEvent,
  Item,
  Mandate,
  POLine,
  PurchaseOrder,
  Supplier,
  SupplierQuote,
} from "@/lib/types";

/** Shapes exactly as GET /api/state serialises them (dates are ISO strings). */

export type StateItem = Item & { daysLeft: number };

export type StatePO = Omit<PurchaseOrder, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  lines?: POLine[];
};

export type StateEvent = Omit<DomainEvent, "ts"> & { ts: string };

export type StateResponse = {
  now: string;
  items: StateItem[];
  suppliers: Supplier[];
  quotes: SupplierQuote[];
  mandate: Mandate;
  weekSpent: number;
  pos: StatePO[];
  events: StateEvent[];
};

export type AgentTraceEntry = {
  step: number;
  iteration: number;
  tool: string;
  ok: boolean;
  durationMs: number;
  args: unknown;
  result: unknown;
};

export const money = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const num = (value: number, digits = 1): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

export function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

export function stockStatus(item: StateItem): "critical" | "low" | "ok" {
  if (item.daysLeft <= 1.5) return "critical";
  if (item.stock <= item.reorderPoint) return "low";
  return "ok";
}
