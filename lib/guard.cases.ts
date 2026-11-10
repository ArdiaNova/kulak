/**
 * Table of guard cases. Pure data: kept separate so guard.test.ts stays readable.
 */
import type { GuardDecision, GuardInput } from "@/lib/types";

export const SUPPLIER = "supplier-1";
export const ITEM = "item-a";
export const NOW = new Date("2026-11-10T09:00:00.000Z");
export const HOUR = 60 * 60 * 1000;

export const KNOWN_CODES = [
  "SUPPLIER_NOT_APPROVED",
  "ITEM_NOT_QUOTED",
  "INVALID_QTY",
  "TOTAL_OVER_HARD_CAP",
  "DUPLICATE_OPEN_PO",
  "TOTAL_OVER_AUTO_CAP",
  "WEEKLY_BUDGET_EXCEEDED",
  "QTY_UNUSUAL",
  "PRICE_SPIKE",
];

export const quotes = (
  over: Partial<{ unitPrice: number; lastPaidPrice: number | null; moq: number }> = {},
) => new Map([[ITEM, { unitPrice: 10, lastPaidPrice: 10, moq: 5, ...over }]]);

const items = new Map([[ITEM, { avgDailyUse: 1 }]]); // 7-day limit = 17.5 units

export const line = (qty: number, unitPrice: number) => ({ itemId: ITEM, qty, unitPrice });

export type InputOverrides = {
  po?: Partial<GuardInput["po"]>;
  mandate?: Partial<GuardInput["mandate"]>;
  supplier?: GuardInput["supplier"];
  quotes?: GuardInput["quotes"];
  items?: GuardInput["items"];
  weekSpent?: number;
  openPOs?: GuardInput["openPOs"];
  now?: Date;
};

export function makeInput(over: InputOverrides = {}): GuardInput {
  const base: GuardInput = {
    po: { supplierId: SUPPLIER, total: 100, lines: [line(10, 10)] },
    mandate: {
      autoApproveCap: 200,
      hardBlockCap: 600,
      weeklyBudget: 450,
      maxQtyMultiple: 2.5,
      maxPriceSpikePct: 20,
    },
    supplier: { id: SUPPLIER, approved: true },
    quotes: quotes(),
    items,
    weekSpent: 0,
    openPOs: [],
    now: NOW,
  };

  return {
    ...base,
    ...over,
    po: { ...base.po, ...(over.po ?? {}) },
    mandate: { ...base.mandate, ...(over.mandate ?? {}) },
  };
}

export type Case = {
  name: string;
  input: GuardInput;
  decision: GuardDecision;
  codes: string[];
};

const c = (
  name: string,
  over: InputOverrides,
  decision: GuardDecision,
  codes: string[],
): Case => ({ name, input: makeInput(over), decision, codes });

export const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR);

export const open = (status: string, hoursAgo: number, itemIds = [ITEM], supplierId = SUPPLIER) => [
  { supplierId, itemIds, status, createdAt: at(hoursAgo) },
];

export const cases: Case[] = [
  c("baseline order approves", {}, "approve", []),

  c("SUPPLIER_NOT_APPROVED alone", { supplier: { id: SUPPLIER, approved: false } }, "deny", [
    "SUPPLIER_NOT_APPROVED",
  ]),

  c(
    "ITEM_NOT_QUOTED alone",
    { po: { supplierId: SUPPLIER, total: 100, lines: [{ itemId: "item-x", qty: 10, unitPrice: 10 }] } },
    "deny",
    ["ITEM_NOT_QUOTED"],
  ),

  c("INVALID_QTY below MOQ", { po: { total: 20, lines: [line(2, 10)] } }, "deny", ["INVALID_QTY"]),
  c("INVALID_QTY at zero", { po: { total: 0, lines: [line(0, 10)] } }, "deny", ["INVALID_QTY"]),
  c("INVALID_QTY does not fire exactly at MOQ", { po: { total: 50, lines: [line(5, 10)] } }, "approve", []),

  // Caps widened so only the hard cap can fire.
  c(
    "TOTAL_OVER_HARD_CAP alone",
    {
      po: { total: 650, lines: [line(10, 65)] },
      mandate: { autoApproveCap: 1000, weeklyBudget: 5000 },
      quotes: quotes({ unitPrice: 65, lastPaidPrice: 65 }),
    },
    "deny",
    ["TOTAL_OVER_HARD_CAP"],
  ),

  c("DUPLICATE_OPEN_PO at 23 h", { openPOs: open("paid", 23) }, "deny", ["DUPLICATE_OPEN_PO"]),
  c("DUPLICATE_OPEN_PO ignores 25 h", { openPOs: open("paid", 25) }, "approve", []),
  c("DUPLICATE_OPEN_PO allows exactly 24 h", { openPOs: open("approved", 24) }, "approve", []),
  c("DUPLICATE_OPEN_PO ignores drafted", { openPOs: open("drafted", 2) }, "approve", []),
  c("DUPLICATE_OPEN_PO ignores rejected", { openPOs: open("rejected", 2) }, "approve", []),
  c(
    "DUPLICATE_OPEN_PO ignores another supplier",
    { openPOs: open("pending_approval", 2, [ITEM], "supplier-2") },
    "approve",
    [],
  ),
  c("DUPLICATE_OPEN_PO ignores no shared item", { openPOs: open("paying", 2, ["item-z"]) }, "approve", []),

  c(
    "TOTAL_OVER_AUTO_CAP alone",
    {
      po: { total: 217.5, lines: [line(10, 21.75)] },
      quotes: quotes({ unitPrice: 21.75, lastPaidPrice: 21.75 }),
    },
    "escalate",
    ["TOTAL_OVER_AUTO_CAP"],
  ),

  c("WEEKLY_BUDGET_EXCEEDED alone", { weekSpent: 400 }, "escalate", ["WEEKLY_BUDGET_EXCEEDED"]),

  c(
    "QTY_UNUSUAL alone",
    { po: { total: 300, lines: [line(30, 10)] }, mandate: { autoApproveCap: 400 } },
    "escalate",
    ["QTY_UNUSUAL"],
  ),
  c(
    "QTY_UNUSUAL does not fire exactly at the limit",
    { po: { total: 175, lines: [line(17.5, 10)] } },
    "approve",
    [],
  ),

  c(
    "PRICE_SPIKE at +20.1%",
    {
      po: { total: 144.12, lines: [line(10, 14.412)] },
      quotes: quotes({ unitPrice: 14.412, lastPaidPrice: 12 }),
    },
    "escalate",
    ["PRICE_SPIKE"],
  ),
  c(
    "PRICE_SPIKE does not fire at exactly +20%",
    { po: { total: 144, lines: [line(10, 14.4)] }, quotes: quotes({ unitPrice: 14.4, lastPaidPrice: 12 }) },
    "approve",
    [],
  ),
  c(
    "PRICE_SPIKE skipped when lastPaidPrice is null",
    { po: { total: 150, lines: [line(10, 15)] }, quotes: quotes({ unitPrice: 15, lastPaidPrice: null }) },
    "approve",
    [],
  ),

  // Caps widened so the two deny reasons are the only ones that can fire.
  c(
    "multiple reasons: unapproved supplier + unusual qty",
    {
      supplier: { id: SUPPLIER, approved: false },
      po: { total: 300, lines: [line(30, 10)] },
      mandate: { autoApproveCap: 400 },
    },
    "deny",
    ["SUPPLIER_NOT_APPROVED", "QTY_UNUSUAL"],
  ),

  c(
    "boundary: total exactly at the auto-approve cap",
    { po: { total: 200, lines: [line(10, 20)] }, quotes: quotes({ unitPrice: 20, lastPaidPrice: 20 }) },
    "approve",
    [],
  ),
  c(
    "boundary: total exactly at the hard cap",
    {
      po: { total: 600, lines: [line(10, 60)] },
      mandate: { autoApproveCap: 600, weeklyBudget: 1000 },
      quotes: quotes({ unitPrice: 60, lastPaidPrice: 60 }),
    },
    "approve",
    [],
  ),
  c("boundary: weekSpent + total exactly at the weekly budget", { weekSpent: 350 }, "approve", []),
];
