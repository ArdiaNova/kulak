"use client";

import { money, relativeTime, shortId, type StateEvent } from "@/components/types";
import { Card, Empty } from "@/components/ui";

const ACTOR: Record<string, { letter: string; className: string }> = {
  agent: { letter: "A", className: "bg-blue-100 text-blue-700" },
  guard: { letter: "G", className: "bg-amber-100 text-amber-700" },
  human: { letter: "H", className: "bg-emerald-100 text-emerald-700" },
  paypal: { letter: "P", className: "bg-indigo-100 text-indigo-700" },
  system: { letter: "S", className: "bg-neutral-200 text-neutral-600" },
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** One readable sentence per event type. Raw JSON never reaches the UI. */
export function describe(event: StateEvent): string {
  const d = event.detail ?? {};
  const po = event.poId ? `PO ${shortId(event.poId)}` : "PO";
  const eventType = str(d.eventType);

  switch (event.type) {
    case "po_created":
      return `${po} drafted${typeof d.total === "number" ? ` · ${money(d.total)}` : ""}`;
    case "guard_decision":
      return `Guard checked ${po} → ${str(d.decision) ?? "?"}`;
    case "po_awaiting_review":
      return `${po} sent to your approval inbox`;
    case "po_escalated":
      return `${po} escalated to you (over the auto-approve cap)`;
    case "po_denied":
      return `${po} denied by the guard`;
    case "po_auto_approved":
      return `${po} auto-approved with PayPal`;
    case "po_approved":
      return `${po} approved by the owner`;
    case "po_approve_blocked":
      return `${po} approval blocked: the guard says deny`;
    case "po_rejected":
      return `${po} rejected by the owner`;
    case "po_delivered":
      return `${po} delivered, stock refilled`;
    case "payout_started":
      return `Payout started${typeof d.amount === "number" ? ` · ${money(d.amount)}` : ""}`;
    case "payout_created":
      return `PayPal batch ${str(d.batchId) ?? ""} created`;
    case "payout_failed":
      return `Payout failed: ${str(d.message) ?? str(d.name) ?? "PayPal error"}`;
    case "payout_synced":
    case "payout_event":
      return `${eventType ? `${eventType.split(".").pop()?.toLowerCase()} → ` : ""}${str(d.status) ?? "logged"}`;
    case "webhook_received":
      return `PayPal webhook ${eventType ?? ""}${d.changed === true ? " · status applied" : ""}`;
    case "webhook_ignored":
      return `Webhook ignored${eventType ? ` (${eventType})` : ""}`;
    case "webhook_rejected":
      return `Webhook rejected: ${str(d.reason) ?? "unknown reason"}`;
    case "webhook_unknown_po":
      return "Webhook for an unknown purchase order";
    case "webhook_error":
      return "Webhook could not read the payout item";
    case "agent_run_started":
      return "Agent run started";
    case "agent_run_finished":
      return `Agent run finished${typeof d.iterations === "number" ? ` in ${d.iterations} iterations` : ""}`;
    case "tool_call":
      return `Tool ${str(d.tool) ?? "call"}${d.ok === false ? " failed" : ""}`;
    case "mandate_updated":
      return "Spending mandate updated";
    case "stock_sold":
      return `Sales recorded${typeof d.qty === "number" ? ` · ${d.qty} ${str(d.sku) ?? ""}` : ""}`;
    default:
      return event.type.replaceAll("_", " ");
  }
}

export function AuditTimeline({ events, now }: { events: StateEvent[]; now: number }) {
  return (
    <Card
      title="Audit timeline"
      hint="Every agent, guard, human, PayPal and system action, newest first."
    >
      {events.length === 0 ? (
        <Empty>No activity yet.</Empty>
      ) : (
        <ol className="max-h-[520px] overflow-y-auto px-4 py-3">
          {events.map((event, index) => {
            const actor = ACTOR[event.actor] ?? ACTOR.system;
            return (
              <li key={event.id ?? `${event.ts}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
                {index < events.length - 1 && (
                  <span className="absolute left-[11px] top-6 h-full w-px bg-neutral-200" aria-hidden />
                )}
                <span
                  className={`relative z-10 mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full text-[10px] font-bold ${actor.className}`}
                  title={event.actor}
                >
                  {actor.letter}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-neutral-700">{describe(event)}</p>
                  <p className="text-[11px] text-neutral-400">
                    {event.actor} · {event.ts ? relativeTime(event.ts, now) : "just now"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
