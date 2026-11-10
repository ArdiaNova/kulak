"use client";

import { useMemo, useState } from "react";

import { ActionBar } from "@/components/action-bar";
import { AgentTrace } from "@/components/agent-trace";
import { ApprovalInbox } from "@/components/approval-inbox";
import { AuditTimeline } from "@/components/audit-timeline";
import { Forecast } from "@/components/forecast";
import { GuardPreview } from "@/components/guard-preview";
import { InventoryGrid } from "@/components/inventory-grid";
import { Kpis } from "@/components/kpis";
import { MandatePanel } from "@/components/mandate-panel";
import { NewOrder } from "@/components/new-order";
import { PODrawer, type POAction } from "@/components/po-drawer";
import { POGrid } from "@/components/po-grid";
import { money } from "@/components/types";
import { Button, Card, Chip, Skeleton } from "@/components/ui";
import { useDashboard } from "@/components/use-dashboard";

const ACTIONS: POAction[] = ["approve", "reject", "sync", "deliver"];

export function Dashboard() {
  const {
    state,
    loading,
    loadError,
    toast,
    setToast,
    busy,
    trace,
    summary,
    round,
    reload,
    runAgent,
    simulateSales,
    simulateRogue,
    placeOrder,
    resetDemo,
    poAction,
  } = useDashboard();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const supplierNames = useMemo(
    () => Object.fromEntries((state?.suppliers ?? []).map((supplier) => [supplier.id, supplier.name])),
    [state?.suppliers],
  );

  const selected = state?.pos.find((po) => po.id === selectedId) ?? null;
  // The note the owner typed when rejecting this order, if there was one.
  const rejectReason = (() => {
    if (!selected || !state) return null;
    const event = state.events.find(
      (candidate) => candidate.type === "po_rejected" && candidate.poId === selected.id,
    );
    const note = event?.detail.reason;
    return typeof note === "string" && note.trim().length > 0 ? note : null;
  })();
  const pending = (state?.pos ?? []).filter((po) => po.status === "pending_approval");
  const busyAction = selected
    ? (ACTIONS.find((action) => busy[`po:${selected.id}:${action}`]) ?? null)
    : null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-6 py-3">
          <div className="grid size-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            K
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-neutral-900">Kulak</h1>
            <p className="text-[11px] text-neutral-500">AI purchasing agent for small cafés</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {state && <Chip tone={state.mandate.mode}>{state.mandate.mode} mode</Chip>}
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
              PayPal Sandbox
            </span>
            {state && (
              <span className="hidden text-[11px] text-neutral-400 sm:inline">
                updated{" "}
                {new Date(state.now).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-6 py-5">
        {!state && loading && <LoadingSkeleton />}

        {!state && !loading && (
          <Card title="Could not load the dashboard">
            <div className="space-y-3 p-4">
              <p className="text-sm text-red-600">{loadError ?? "Unknown error."}</p>
              <Button onClick={reload}>Try again</Button>
            </div>
          </Card>
        )}

        {state && (
          <>
            <Kpis state={state} />
            <Forecast state={state} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <InventoryGrid items={state.items} />
                <POGrid pos={state.pos} supplierNames={supplierNames} onSelect={setSelectedId} />
              </div>
              <div className="flex flex-col gap-4">
                <ActionBar
                  items={state.items}
                  busy={busy}
                  onRun={runAgent}
                  onSales={simulateSales}
                  onRogue={simulateRogue}
                  onReset={resetDemo}
                />
                <NewOrder state={state} busy={Boolean(busy.order)} onPlace={placeOrder} />
                <ApprovalInbox
                  pos={pending}
                  supplierNames={supplierNames}
                  busy={(id, action) => Boolean(busy[`po:${id}:${action}`])}
                  onAction={poAction}
                  onOpen={setSelectedId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-4">
                <MandatePanel
                  state={state}
                  onSaved={reload}
                  onError={(message) => setToast({ kind: "error", message })}
                />
                <GuardPreview state={state} />
              </div>
              <div className="relative xl:min-h-0">
                {/* Absolutely positioned on wide screens so a long audit trail
                    can never stretch the row past the mandate column: it ends
                    level with that column and the extra events scroll. */}
                <div className="xl:absolute xl:inset-0">
                  <AuditTimeline events={state.events} now={Date.parse(state.now)} />
                </div>
              </div>
            </div>

            {/* Last on the page on purpose: a streaming run scrolls inside this
                panel and can never push the cards above it around. */}
            <AgentTrace
              trace={trace}
              summary={summary}
              running={Boolean(busy.agent)}
              round={round}
            />

            <p className="pb-4 text-center text-[11px] text-neutral-400">
              Money moves only after <code className="rounded bg-neutral-200/60 px-1">lib/guard.ts</code>{" "}
              approves. Payouts use the PayPal sandbox — no real money. Weekly spend so far:{" "}
              {money(state.weekSpent)} of {money(state.mandate.weeklyBudget)}.
            </p>
          </>
        )}
      </main>

      {selected && state && (
        <PODrawer
          po={selected}
          items={state.items}
          quotes={state.quotes}
          suppliers={state.suppliers}
          supplierName={supplierNames[selected.supplierId] ?? selected.supplierId}
          rejectReason={rejectReason}
          busyAction={busyAction}
          onAction={(action, reason) => poAction(selected.id, action, reason)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] max-w-sm">
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              toast.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <p className="text-sm leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-xs opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Skeleton className="h-[380px]" />
          <Skeleton className="h-[420px]" />
        </div>
        <Skeleton className="h-[520px]" />
      </div>
    </div>
  );
}
