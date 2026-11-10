"use client";

import type { POLine, Supplier, SupplierQuote } from "@/lib/types";

import { money, type StateItem } from "@/components/types";

/**
 * The order lines, each with the cheapest approved alternative so the owner can
 * see whether the agent paid a fair price. Quotes come from /api/state; nothing
 * is recomputed from the browser's own data.
 */
export function POLines({
  lines,
  items,
  quotes,
  suppliers,
  supplierId,
}: {
  lines: POLine[];
  items: StateItem[];
  quotes: SupplierQuote[];
  suppliers: Supplier[];
  supplierId: string;
}) {
  const nameOf = (itemId: string) => items.find((item) => item.id === itemId)?.name ?? itemId;
  const supplierName = (id: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? id;
  const approved = new Set(suppliers.filter((supplier) => supplier.approved).map((s) => s.id));

  function bestAlternative(itemId: string) {
    const options = quotes.filter(
      (quote) =>
        quote.itemId === itemId &&
        quote.supplierId !== supplierId &&
        approved.has(quote.supplierId),
    );
    if (options.length === 0) return null;
    return options.reduce((best, quote) => (quote.unitPrice < best.unitPrice ? quote : best));
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {lines.map((line, index) => {
        const best = bestAlternative(line.itemId);
        const own = quotes.find(
          (quote) => quote.itemId === line.itemId && quote.supplierId === supplierId,
        );
        const dearer = best ? line.unitPrice > best.unitPrice : false;

        return (
          <li key={line.id ?? index} className="px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-neutral-900">{nameOf(line.itemId)}</p>
                <p className="text-xs tabular-nums text-neutral-500">
                  {line.qty} × {money(line.unitPrice)}
                  {own?.lastPaidPrice !== null && own?.lastPaidPrice !== undefined && (
                    <span className="ml-2 text-neutral-400">
                      last paid {money(own.lastPaidPrice)}
                    </span>
                  )}
                </p>
              </div>
              <p className="tabular-nums text-neutral-900">{money(line.qty * line.unitPrice)}</p>
            </div>
            {best ? (
              <p className={`mt-1 text-[11px] ${dearer ? "text-amber-600" : "text-emerald-600"}`}>
                {dearer
                  ? `${money(line.unitPrice - best.unitPrice)} per unit above ${supplierName(best.supplierId)} (${money(best.unitPrice)})`
                  : "Matches the cheapest approved quote"}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-400">
                No other approved supplier quotes this item.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
