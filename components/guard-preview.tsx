"use client";

import { useMemo, useState } from "react";

import { buildGuardInput } from "@/lib/executor.shared";
import { evaluatePO } from "@/lib/guard";
import type { Mandate, PurchaseOrder } from "@/lib/types";

import { money, shortId, type StateResponse } from "@/components/types";
import { Button, Card, Chip, Empty, statusLabel } from "@/components/ui";

const TONE: Record<string, string> = { approve: "ok", escalate: "low", deny: "critical" };

type Caps = Pick<
  Mandate,
  "autoApproveCap" | "hardBlockCap" | "weeklyBudget" | "maxQtyMultiple" | "maxPriceSpikePct"
>;

const SLIDERS: {
  key: keyof Caps;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}[] = [
  { key: "autoApproveCap", label: "Auto-approve cap", min: 0, max: 1000, step: 10, format: money },
  { key: "hardBlockCap", label: "Hard block cap", min: 0, max: 2000, step: 10, format: money },
  { key: "weeklyBudget", label: "Weekly budget", min: 0, max: 2000, step: 50, format: money },
  {
    key: "maxQtyMultiple",
    label: "Max quantity",
    min: 0.5,
    max: 6,
    step: 0.1,
    format: (value) => `×${value.toFixed(1)}`,
  },
  {
    key: "maxPriceSpikePct",
    label: "Max price spike",
    min: 0,
    max: 100,
    step: 1,
    format: (value) => `${value}%`,
  },
];

const toCaps = (mandate: Mandate): Caps => ({
  autoApproveCap: mandate.autoApproveCap,
  hardBlockCap: mandate.hardBlockCap,
  weeklyBudget: mandate.weeklyBudget,
  maxQtyMultiple: mandate.maxQtyMultiple,
  maxPriceSpikePct: mandate.maxPriceSpikePct,
});

/**
 * The guard is pure, so the browser can run the exact same lib/guard.ts the
 * server uses. Move the sliders and watch the verdict change on a real order.
 * Nothing here saves anything or calls PayPal.
 */
export function GuardPreview({ state }: { state: StateResponse }) {
  const pos = useMemo(
    () => [...state.pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.pos],
  );
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Caps | null>(null);

  // No effects here on purpose: the selection follows the newest relevant PO
  // until the owner picks one, and an untouched slider set follows the saved
  // mandate. Reset drops the draft, so polling cannot fight the user.
  const selectedId =
    pickedId && pos.some((po) => po.id === pickedId)
      ? pickedId
      : (pos.find((po) => po.status === "pending_approval")?.id ?? pos[0]?.id ?? null);

  const caps = draft ?? toCaps(state.mandate);
  const supplierName = (id: string) => state.suppliers.find((s) => s.id === id)?.name ?? id;
  const selected = pos.find((po) => po.id === selectedId) ?? null;

  const verdicts = useMemo(() => {
    if (!selected) return null;
    const purchaseOrders: PurchaseOrder[] = pos.map((po) => ({
      ...po,
      createdAt: new Date(po.createdAt),
      updatedAt: new Date(po.updatedAt),
    }));
    const target = purchaseOrders.find((po) => po.id === selected.id);
    if (!target) return null;

    const run = (mandate: Caps) =>
      evaluatePO(
        buildGuardInput({
          po: target,
          mandate: { ...state.mandate, ...mandate },
          suppliers: state.suppliers,
          quotes: state.quotes,
          items: state.items,
          pos: purchaseOrders,
          now: new Date(state.now),
        }),
      );

    return { saved: run(toCaps(state.mandate)), draft: run(caps) };
  }, [selected, pos, caps, state]);

  return (
    <Card
      title="Mandate what-if"
      action={<span className="text-xs text-neutral-500">runs the real guard</span>}
    >
      {!selected || !verdicts ? (
        <Empty>No purchase order yet. Run the agent, then try the sliders here.</Empty>
      ) : (
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-neutral-400">
              Purchase order
            </span>
            <select
              value={selected.id}
              onChange={(event) => setPickedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {pos.map((po) => (
                <option key={po.id} value={po.id}>
                  {shortId(po.id)} · {supplierName(po.supplierId)} · {money(po.total)} ·{" "}
                  {statusLabel(po.status)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2.5">
            {SLIDERS.map((slider) => (
              <label key={slider.key} className="block">
                <span className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-neutral-700">{slider.label}</span>
                  <span className="tabular-nums text-neutral-500">
                    {slider.format(caps[slider.key])}
                  </span>
                </span>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={caps[slider.key]}
                  onChange={(event) =>
                    setDraft({ ...caps, [slider.key]: Number(event.target.value) })
                  }
                  className="mt-1 w-full accent-blue-600"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Saved mandate", result: verdicts.saved },
              { label: "With these numbers", result: verdicts.draft },
            ].map((column) => (
              <div
                key={column.label}
                className={`rounded-lg border px-3 py-2 ${
                  column.label === "With these numbers" ? "border-blue-200 bg-blue-50/50" : "border-neutral-200"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{column.label}</p>
                <div className="mt-1">
                  <Chip tone={TONE[column.result.decision] ?? "low"}>{column.result.decision}</Chip>
                </div>
                {column.result.reasons.length === 0 ? (
                  <p className="mt-1 text-[11px] text-emerald-700">Every rule passes.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {column.result.reasons.map((reason) => (
                      <li key={reason.code} className="text-[11px] leading-relaxed text-neutral-600">
                        <span className="font-mono text-[10px] text-neutral-400">{reason.code}</span>
                        <br />
                        {reason.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-neutral-500">
              Nothing is saved and no money moves. Change the real rules above.
            </p>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
