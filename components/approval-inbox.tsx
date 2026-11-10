"use client";

import { useState } from "react";

import { RejectNote } from "@/components/reject-note";
import { money, shortId, type StatePO } from "@/components/types";
import { Button, Card, Chip } from "@/components/ui";

/**
 * The only place a human can release money. Each card shows the guard's written
 * reasons so the decision is informed, not a rubber stamp.
 */
export function ApprovalInbox({
  pos,
  supplierNames,
  busy,
  onAction,
  onOpen,
}: {
  pos: StatePO[];
  supplierNames: Record<string, string>;
  busy: (id: string, action: "approve" | "reject") => boolean;
  onAction: (id: string, action: "approve" | "reject", reason?: string) => void;
  onOpen: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState<string | null>(null);

  return (
    <Card
      title="Approval inbox"
      hint="Orders the mandate escalated to you. Approve to pay with PayPal, or reject."
      className="flex min-h-0 flex-1 flex-col"
      action={<span className="text-xs text-neutral-500">{pos.length} waiting</span>}
    >
      {pos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-neutral-500">
          Nothing waiting for you. Run the agent to draft new orders.
        </div>
      ) : (
        // The card fills the sidebar next to the tables, so the two columns end
        // level. Orders are never clipped: only a list longer than the card
        // scrolls.
        <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          {pos.map((po) => (
            <li key={po.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {supplierNames[po.supplierId] ?? po.supplierId}
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">
                      {shortId(po.id)}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-neutral-600">
                    {po.rationale ?? "No rationale given."}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums text-sm font-semibold text-neutral-900">
                  {money(po.total)}
                </p>
              </div>

              {po.guardReasons.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {po.guardReasons.map((reason) => (
                    <li key={reason.code}>
                      <span title={reason.message}>
                        <Chip tone={reason.severity === "deny" ? "critical" : "low"}>
                          {reason.code.replaceAll("_", " ").toLowerCase()}
                        </Chip>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  busy={busy(po.id, "approve")}
                  onClick={() => onAction(po.id, "approve")}
                >
                  Approve &amp; pay
                </Button>
                <Button
                  variant="danger"
                  busy={busy(po.id, "reject")}
                  onClick={() => setRejecting(po.id)}
                >
                  Reject
                </Button>
                <Button variant="ghost" onClick={() => onOpen(po.id)}>
                  Details
                </Button>
              </div>

              {rejecting === po.id && (
                <RejectNote
                  busy={busy(po.id, "reject")}
                  onCancel={() => setRejecting(null)}
                  onConfirm={(reason) => {
                    setRejecting(null);
                    onAction(po.id, "reject", reason);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
