import type {
  GuardDecision,
  GuardInput,
  GuardResult,
  Reason,
} from "@/lib/types";

/**
 * The spending mandate, evaluated in plain code. Pure: no I/O, no clock, no LLM.
 * Time is the `now` input. The LLM cannot change or bypass any of this.
 *
 * Every rule is evaluated and every reason collected. "Over" means strictly
 * greater, so exactly at a cap is fine. A tiny epsilon keeps float artifacts
 * (e.g. 12 * 1.2 = 14.399999999999999) from firing a rule at an exact boundary.
 */

const HOUR_MS = 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 24 * HOUR_MS;
const EPS = 1e-9;

const OPEN_STATUSES = new Set(["pending_approval", "approved", "paying", "paid"]);

const over = (a: number, b: number): boolean => a > b + EPS;

const money = (n: number): string => `$${n.toFixed(2)}`;
const qty = (n: number): string => String(Number(n.toFixed(3)));

function reason(
  code: string,
  severity: Reason["severity"],
  message: string,
): Reason {
  return { code, severity, message };
}

function checkSupplier(input: GuardInput): Reason | null {
  if (input.supplier.approved !== false) return null;
  return reason(
    "SUPPLIER_NOT_APPROVED",
    "deny",
    "This supplier is not on the approved supplier list.",
  );
}

function checkQuoted(input: GuardInput): Reason | null {
  const line = input.po.lines.find((l) => !input.quotes.has(l.itemId));
  if (!line) return null;
  return reason(
    "ITEM_NOT_QUOTED",
    "deny",
    "An item on this order has no quote from the selected supplier.",
  );
}

function checkQty(input: GuardInput): Reason | null {
  const line = input.po.lines.find((l) => {
    if (l.qty <= 0) return true;
    const quote = input.quotes.get(l.itemId);
    return quote ? l.qty < quote.moq : false;
  });
  if (!line) return null;

  if (line.qty <= 0) {
    return reason(
      "INVALID_QTY",
      "deny",
      `Quantity ${qty(line.qty)} is not a valid quantity.`,
    );
  }

  const moq = input.quotes.get(line.itemId)?.moq ?? 0;
  return reason(
    "INVALID_QTY",
    "deny",
    `Quantity ${qty(line.qty)} is below the supplier minimum order quantity of ${qty(moq)}.`,
  );
}

function checkHardCap(input: GuardInput): Reason | null {
  const cap = input.mandate.hardBlockCap;
  if (!over(input.po.total, cap)) return null;
  return reason(
    "TOTAL_OVER_HARD_CAP",
    "deny",
    `Total ${money(input.po.total)} is over the ${money(cap)} hard cap.`,
  );
}

function checkDuplicate(input: GuardInput): Reason | null {
  const items = new Set(input.po.lines.map((l) => l.itemId));
  const match = input.openPOs.find(
    (po) =>
      po.supplierId === input.po.supplierId &&
      OPEN_STATUSES.has(po.status) &&
      input.now.getTime() - po.createdAt.getTime() < DUPLICATE_WINDOW_MS &&
      po.itemIds.some((id) => items.has(id)),
  );
  if (!match) return null;

  const hours = Math.max(
    0,
    (input.now.getTime() - match.createdAt.getTime()) / HOUR_MS,
  );
  return reason(
    "DUPLICATE_OPEN_PO",
    "deny",
    `A ${match.status.replace("_", " ")} order with this supplier and overlapping items was created ${hours.toFixed(1)} h ago; the duplicate window is 24 h.`,
  );
}

function checkAutoCap(input: GuardInput): Reason | null {
  const cap = input.mandate.autoApproveCap;
  if (!over(input.po.total, cap)) return null;
  return reason(
    "TOTAL_OVER_AUTO_CAP",
    "escalate",
    `Total ${money(input.po.total)} is over the ${money(cap)} auto-approve cap.`,
  );
}

function checkWeeklyBudget(input: GuardInput): Reason | null {
  const budget = input.mandate.weeklyBudget;
  const after = input.weekSpent + input.po.total;
  if (!over(after, budget)) return null;
  return reason(
    "WEEKLY_BUDGET_EXCEEDED",
    "escalate",
    `This order would bring the weekly spend to ${money(after)}, over the ${money(budget)} weekly budget.`,
  );
}

function checkUnusualQty(input: GuardInput): Reason | null {
  const limitFactor = input.mandate.maxQtyMultiple;
  const line = input.po.lines.find((l) => {
    const item = input.items.get(l.itemId);
    if (!item) return false;
    return over(l.qty, limitFactor * item.avgDailyUse * 7);
  });
  if (!line) return null;

  const avgDailyUse = input.items.get(line.itemId)?.avgDailyUse ?? 0;
  const limit = limitFactor * avgDailyUse * 7;
  return reason(
    "QTY_UNUSUAL",
    "escalate",
    `Quantity ${qty(line.qty)} is more than ${limitFactor}x the usual 7-day use of ${qty(limit)}.`,
  );
}

function checkPriceSpike(input: GuardInput): Reason | null {
  const pct = input.mandate.maxPriceSpikePct;
  const line = input.po.lines.find((l) => {
    const last = input.quotes.get(l.itemId)?.lastPaidPrice;
    return last != null && over(l.unitPrice, last * (1 + pct / 100));
  });
  if (!line) return null;

  const last = input.quotes.get(line.itemId)?.lastPaidPrice ?? 0;
  const change = last > 0 ? ((line.unitPrice / last - 1) * 100).toFixed(1) : "∞";
  return reason(
    "PRICE_SPIKE",
    "escalate",
    `Unit price ${money(line.unitPrice)} is ${change}% above the last paid price ${money(last)} (limit ${pct}%).`,
  );
}

const RULES = [
  checkSupplier,
  checkQuoted,
  checkQty,
  checkHardCap,
  checkDuplicate,
  checkAutoCap,
  checkWeeklyBudget,
  checkUnusualQty,
  checkPriceSpike,
];

function decide(reasons: Reason[]): GuardDecision {
  if (reasons.some((r) => r.severity === "deny")) return "deny";
  if (reasons.length > 0) return "escalate";
  return "approve";
}

export function evaluatePO(input: GuardInput): GuardResult {
  const reasons: Reason[] = [];
  for (const rule of RULES) {
    const found = rule(input);
    if (found) reasons.push(found);
  }
  return { decision: decide(reasons), reasons };
}
