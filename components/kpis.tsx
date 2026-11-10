import { money, num } from "@/components/types";
import type { StateResponse } from "@/components/types";

/** Four numbers a café owner cares about, plus the budget bar. */

export function Kpis({ state }: { state: StateResponse }) {
  const budget = state.mandate.weeklyBudget;
  const spent = state.weekSpent;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const low = state.items.filter((item) => item.stock <= item.reorderPoint).length;
  const open = state.pos.filter((po) =>
    ["pending_approval", "approved", "paying", "paid"].includes(po.status),
  ).length;
  const paidThisWeek = state.pos
    .filter((po) => ["paid", "delivered"].includes(po.status))
    .reduce((sum, po) => sum + po.total, 0);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">Spent this week</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {money(spent)}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${pct > 90 ? "bg-amber-500" : "bg-blue-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-neutral-500 tabular-nums">
          of {money(budget)} weekly budget
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">Open purchase orders</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{open}</p>
        <p className="mt-1.5 text-xs text-neutral-500">
          pending, approved, paying or paid
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">Items below reorder point</p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${low > 0 ? "text-amber-600" : "text-neutral-900"}`}
        >
          {low}
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">
          {low > 0 ? "agent should restock these" : "stock is healthy"}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">Paid this week</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {money(paidThisWeek)}
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">
          {state.pos.length} orders in the audit window · {num(low)} low
        </p>
      </div>
    </div>
  );
}
