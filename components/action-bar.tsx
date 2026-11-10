"use client";

import { useState } from "react";

import type { StateItem } from "@/components/types";
import { Button, Card } from "@/components/ui";

/** The four demo levers the PRD script uses. Reset always asks first. */
export function ActionBar({
  items,
  busy,
  onRun,
  onSales,
  onRogue,
  onReset,
}: {
  items: StateItem[];
  busy: Record<string, boolean>;
  onRun: () => void;
  onSales: (itemId?: string) => void;
  onRogue: () => void;
  onReset: () => void;
}) {
  const [itemId, setItemId] = useState("");

  return (
    <Card
      title="Demo controls"
      hint="The agent, a sales day, a hostile agent, and a full reset of the seeded café."
    >
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" busy={busy.agent} onClick={onRun}>
            Run agent
          </Button>
          <Button busy={busy.rogue} onClick={onRogue}>
            Simulate rogue agent
          </Button>
          <Button
            variant="danger"
            busy={busy.reset}
            onClick={() => {
              if (window.confirm("Reset the demo? This clears every purchase order, payout and event.")) {
                onReset();
              }
            }}
          >
            Reset demo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            aria-label="Item to sell"
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Random item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.stock} {item.unit}
              </option>
            ))}
          </select>
          <Button busy={busy.sales} onClick={() => onSales(itemId || undefined)}>
            Simulate sales
          </Button>
        </div>

        <p className="text-[11px] leading-relaxed text-neutral-500">
          Sales lower stock — pick an item or leave it random. The rogue order tries to
          overspend; reset restores the seeded café.
        </p>
      </div>
    </Card>
  );
}
