"use client";

import { useEffect } from "react";

import { money, shortId, type StateItem, type StatePO } from "@/components/types";
import { Button, Chip, statusLabel } from "@/components/ui";

export type POAction = "approve" | "reject" | "deliver" | "sync";

const DECISION_TONE: Record<string, string> = { approve: "ok", escalate: "low", deny: "critical" };

/**
 * Side drawer instead of AG Grid master/detail, which is an Enterprise feature.
 * Esc closes it; the actions mirror the order lifecycle exactly.
 */
export function PODrawer({
  po,
  items,
  supplierName,
  busyAction,
  onAction,
  onClose,
}: {
  po: StatePO;
  items: StateItem[];
  supplierName: string;
  busyAction: POAction | null;
  onAction: (action: POAction) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lines = po.lines ?? [];
  const nameOf = (itemId: string) =>
    items.find((item) => item.id === itemId)?.name ?? itemId;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-neutral-900/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Purchase order details"
        className="relative flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-neutral-500">Purchase order</p>
            <h2 className="mt-0.5 font-mono text-sm text-neutral-900">{shortId(po.id)}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Chip tone={po.status}>{statusLabel(po.status)}</Chip>
              {po.guardDecision && (
                <Chip tone={DECISION_TONE[po.guardDecision] ?? "low"}>
                  guard: {po.guardDecision}
                </Chip>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} title="Close (Esc)">
            Esc
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-400">Supplier</dt>
              <dd className="mt-0.5 text-neutral-900">{supplierName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-400">Total</dt>
              <dd className="mt-0.5 tabular-nums font-semibold text-neutral-900">
                {money(po.total)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-400">Created by</dt>
              <dd className="mt-0.5 capitalize text-neutral-900">{po.createdBy}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-400">Created</dt>
              <dd className="mt-0.5 text-neutral-900">
                {new Date(po.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-neutral-400">
                PayPal batch
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                {po.payoutBatchId ?? "not paid yet"}
              </dd>
            </div>
          </dl>

          {po.rationale && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Why</p>
              <p className="mt-1 leading-relaxed text-neutral-700">{po.rationale}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Lines ({lines.length})
            </p>
            <ul className="mt-1 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {lines.map((line, index) => (
                <li key={line.id ?? index} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div>
                    <p className="text-neutral-900">{nameOf(line.itemId)}</p>
                    <p className="text-xs tabular-nums text-neutral-500">
                      {line.qty} × {money(line.unitPrice)}
                    </p>
                  </div>
                  <p className="tabular-nums text-neutral-900">{money(line.qty * line.unitPrice)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Mandate checks
            </p>
            {po.guardReasons.length === 0 ? (
              <p className="mt-1 text-emerald-700">Every rule passed.</p>
            ) : (
              <ul className="mt-1 space-y-2">
                {po.guardReasons.map((reason) => (
                  <li
                    key={reason.code}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Chip tone={reason.severity === "deny" ? "critical" : "low"}>
                        {reason.severity}
                      </Chip>
                      <code className="text-[11px] text-neutral-500">{reason.code}</code>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-700">{reason.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3">
          {po.status === "pending_approval" && (
            <>
              <Button
                variant="danger"
                busy={busyAction === "reject"}
                onClick={() => onAction("reject")}
              >
                Reject
              </Button>
              <Button variant="primary" busy={busyAction === "approve"} onClick={() => onAction("approve")}>
                Approve &amp; pay
              </Button>
            </>
          )}
          {po.status === "paying" && (
            <Button busy={busyAction === "sync"} onClick={() => onAction("sync")}>
              Sync with PayPal
            </Button>
          )}
          {po.status === "paid" && (
            <Button variant="primary" busy={busyAction === "deliver"} onClick={() => onAction("deliver")}>
              Mark delivered
            </Button>
          )}
          {(po.status === "delivered" ||
            po.status === "denied" ||
            po.status === "rejected" ||
            po.status === "payment_failed") && (
            <p className="text-xs text-neutral-500">No further action.</p>
          )}
        </footer>
      </aside>
    </div>
  );
}
