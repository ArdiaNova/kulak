"use client";

import { Button, Card } from "@/components/ui";

/** The four demo levers the PRD script uses. Reset always asks first. */
export function ActionBar({
  busy,
  onRun,
  onSales,
  onRogue,
  onReset,
}: {
  busy: Record<string, boolean>;
  onRun: () => void;
  onSales: () => void;
  onRogue: () => void;
  onReset: () => void;
}) {
  return (
    <Card
      title="Demo controls"
      hint="The agent, a normal sales day, a hostile agent, and a full reset of the seeded café."
    >
      <div className="flex flex-wrap items-center gap-2 p-4">
        <Button variant="primary" busy={busy.agent} onClick={onRun}>
          Run agent
        </Button>
        <Button busy={busy.sales} onClick={onSales}>
          Simulate sales
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
        <p className="ml-auto max-w-sm text-[11px] leading-relaxed text-neutral-500">
          Sales lower stock, the agent drafts and submits orders, the rogue order tries to
          overspend, reset restores the seeded café.
        </p>
      </div>
    </Card>
  );
}
