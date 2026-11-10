"use client";

import { useState } from "react";

import { money, type StateResponse } from "@/components/types";
import { Button, Card } from "@/components/ui";

type Option = {
  supplierId: string;
  supplierName: string;
  approved: boolean;
  unitPrice: number;
  unit: string;
};

/**
 * Owner-initiated order. The agent does not get a say here, but the mandate
 * still does: prices come from supplier_quotes and lib/guard.ts decides.
 */
export function NewOrder({
  state,
  busy,
  onPlace,
}: {
  state: StateResponse;
  busy: boolean;
  onPlace: (input: { supplierId: string; itemId: string; qty: number }) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [qty, setQty] = useState("");

  const item = state.items.find((candidate) => candidate.id === itemId) ?? null;
  const options: Option[] = item
    ? state.quotes
        .filter((quote) => quote.itemId === item.id)
        .flatMap((quote) => {
          const supplier = state.suppliers.find((candidate) => candidate.id === quote.supplierId);
          if (!supplier) return [];
          return [
            {
              supplierId: supplier.id,
              supplierName: supplier.name,
              approved: supplier.approved,
              unitPrice: quote.unitPrice,
              unit: item.unit,
            },
          ];
        })
        .sort(
          (a, b) =>
            Number(b.approved) - Number(a.approved) || a.unitPrice - b.unitPrice,
        )
    : [];

  const chosen = options.find((option) => option.supplierId === supplierId) ?? null;
  const qtyNumber = Number(qty);
  const total = chosen && Number.isFinite(qtyNumber) ? qtyNumber * chosen.unitPrice : 0;
  const canPlace = Boolean(chosen?.approved) && qtyNumber > 0 && !busy;

  function pickItem(id: string) {
    setItemId(id);
    const nextItem = state.items.find((candidate) => candidate.id === id) ?? null;
    const nextOptions = nextItem
      ? state.quotes
          .filter((quote) => quote.itemId === nextItem.id)
          .flatMap((quote) => {
            const supplier = state.suppliers.find((c) => c.id === quote.supplierId);
            return supplier ? [{ ...supplier, unitPrice: quote.unitPrice }] : [];
          })
          .sort(
            (a, b) => Number(b.approved) - Number(a.approved) || a.unitPrice - b.unitPrice,
          )
      : [];
    const best = nextOptions[0] ?? null;
    setSupplierId(best?.id ?? "");
    setQty(nextItem ? String(Math.max(1, Math.ceil(nextItem.avgDailyUse * 7))) : "");
  }

  return (
    <Card
      title="New order"
      hint="Owner-initiated purchase for something the agent did not suggest. The same guard still checks it."
      className="shrink-0"
    >
      <div className="space-y-2 p-4">
        <select
          value={itemId}
          onChange={(event) => pickItem(event.target.value)}
          aria-label="Item to order"
          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Choose an item…</option>
          {state.items.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.stock} {candidate.unit} · {candidate.daysLeft} days left
            </option>
          ))}
        </select>

        <select
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          aria-label="Supplier"
          disabled={options.length === 0}
          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-neutral-50 disabled:text-neutral-400"
        >
          {options.length === 0 && <option value="">No supplier quotes this item</option>}
          {options.map((option) => (
            <option key={option.supplierId} value={option.supplierId} disabled={!option.approved}>
              {option.supplierName} · {money(option.unitPrice)}/{option.unit}
              {option.approved ? "" : " · not approved"}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.1"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            aria-label="Quantity"
            className="w-24 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <span className="text-xs text-neutral-500">{item?.unit ?? "qty"}</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-neutral-900">
            {money(total)}
          </span>
        </div>

        <Button
          variant="primary"
          busy={busy}
          disabled={!canPlace}
          onClick={() => {
            if (!chosen) return;
            const ok = window.confirm(
              `Place this order for ${money(total)}? The mandate decides: inside your auto-approve cap it pays right away with PayPal sandbox money.`,
            );
            if (ok) onPlace({ supplierId: chosen.supplierId, itemId, qty: qtyNumber });
          }}
        >
          Place order
        </Button>

        <p className="text-[11px] leading-relaxed text-neutral-500">
          You place it, so you approve it: below the auto-approve cap it is paid immediately,
          above it it waits in your inbox, and the hard cap or an odd quantity is still denied.
        </p>
      </div>
    </Card>
  );
}
