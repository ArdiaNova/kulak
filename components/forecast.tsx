"use client";

import { money, num, type StateResponse } from "@/components/types";

/**
 * Cash-out preview: money already waiting in the inbox plus the next item that
 * will run out. All numbers come from /api/state; nothing is estimated from the
 * browser's own clock.
 */
export function Forecast({ state }: { state: StateResponse }) {
  const waiting = state.pos
    .filter((po) => po.status === "pending_approval")
    .reduce((sum, po) => sum + po.total, 0);
  const waitingCount = state.pos.filter((po) => po.status === "pending_approval").length;

  const budget = state.mandate.weeklyBudget;
  const projected = state.weekSpent + waiting;
  const over = projected > budget;
  const pct = budget > 0 ? Math.min(100, Math.round((projected / budget) * 100)) : 0;

  const tightest = [...state.items].sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Waiting for you
        </p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
          {money(waiting)}
        </p>
        <p className="text-[11px] text-neutral-500">
          {waitingCount === 1 ? "1 order in the inbox" : `${waitingCount} orders in the inbox`}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Projected week spend
        </p>
        <p
          className={`mt-0.5 text-lg font-semibold tabular-nums ${over ? "text-red-600" : "text-neutral-900"}`}
        >
          {money(projected)}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-blue-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          {over
            ? `${money(projected - budget)} over the weekly budget`
            : `${money(budget - projected)} of budget left`}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Next to run out
        </p>
        <p className="mt-0.5 truncate text-lg font-semibold text-neutral-900">
          {tightest ? tightest.name : "—"}
        </p>
        <p className="text-[11px] text-neutral-500">
          {tightest ? `${num(tightest.daysLeft)} days left at current burn` : "no stock data"}
        </p>
      </div>
    </div>
  );
}
