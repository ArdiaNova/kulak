"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { messageFrom, send, streamAgent } from "@/components/api";
import type { POAction } from "@/components/po-drawer";
import type { AgentTraceEntry, StateResponse } from "@/components/types";

export type Toast = { kind: "ok" | "error"; message: string };

/**
 * One owner of dashboard state: load, poll, act, refresh. Polls every 3 s while
 * a payout is in flight, every 15 s otherwise (skill dashboard-ui).
 */
export function useDashboard() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [run, setRun] = useState<{ trace: AgentTraceEntry[]; summary: string } | null>(null);
  const [round, setRound] = useState(0);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (silent: boolean) => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(await messageFrom(response));
      const body = (await response.json()) as StateResponse;
      if (!mounted.current) return;
      setState(body);
      setLoadError(null);
    } catch (error) {
      if (!mounted.current || silent) return;
      setLoadError(error instanceof Error ? error.message : "Could not load the dashboard.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const paying = state?.pos.some((po) => po.status === "paying") ?? false;
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh(true).finally(() => {
        if (mounted.current) setTick((value) => value + 1);
      });
    }, paying ? 3000 : 15000);
    return () => clearTimeout(timer);
  }, [tick, paying, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const perform = useCallback(
    async (key: string, label: string, fn: () => Promise<string>) => {
      setBusy((current) => ({ ...current, [key]: true }));
      try {
        const message = await fn();
        setToast({ kind: "ok", message });
        await refresh(true);
      } catch (error) {
        setToast({
          kind: "error",
          message: error instanceof Error ? error.message : `${label} failed.`,
        });
      } finally {
        setBusy((current) => ({ ...current, [key]: false }));
      }
    },
    [refresh],
  );

  const runAgent = useCallback(
    () =>
      perform("agent", "Agent run", async () => {
        setRun({ trace: [], summary: "" });
        setRound(0);
        // Each tool call lands in the panel while the model is still working.
        const result = await streamAgent((event) => {
          if (event.type === "round") {
            setRound(event.iteration + 1);
            return;
          }
          if (event.type !== "tool") return;
          setRun((current) => ({
            trace: [...(current?.trace ?? []), event.entry],
            summary: current?.summary ?? "",
          }));
        });
        setRun({ trace: result.trace, summary: result.summary });
        return `Agent finished: ${result.purchaseOrders.length} purchase orders.`;
      }),
    [perform],
  );

  const simulateSales = useCallback(
    () =>
      perform("sales", "Sales", async () => {
        const body = (await send("/api/sim/sales")) as {
          name?: string;
          sold?: number;
          stock?: number;
        };
        return `Sold ${body.sold ?? 0} of ${body.name ?? "an item"} · stock now ${body.stock ?? "?"}.`;
      }),
    [perform],
  );

  const simulateRogue = useCallback(
    () =>
      perform("rogue", "Rogue order", async () => {
        const body = (await send("/api/sim/rogue")) as {
          supplier?: string;
          total?: number;
          status?: string;
          decision?: string;
        };
        if (body.status === "denied") {
          return `Guard denied the rogue order to ${body.supplier} ($${body.total}). No payment.`;
        }
        return `Rogue order to ${body.supplier} → ${body.status} (guard: ${body.decision}).`;
      }),
    [perform],
  );

  const resetDemo = useCallback(
    () =>
      perform("reset", "Reset", async () => {
        await send("/api/sim/reset");
        setRun(null);
        return "Demo reset: seeded stock, no orders.";
      }),
    [perform],
  );

  const poAction = useCallback(
    (id: string, action: POAction) =>
      perform(`po:${id}:${action}`, `PO ${action}`, async () => {
        const body = (await send(`/api/pos/${id}/${action}`)) as { status?: string } | null;
        const labels: Record<POAction, string> = {
          approve: "Approved and sent to PayPal",
          reject: "Rejected",
          deliver: "Delivery recorded, stock refilled",
          sync: "Synced with PayPal",
        };
        return `${labels[action]}${body?.status ? ` → ${body.status}` : ""}.`;
      }),
    [perform],
  );

  return {
    state,
    loading,
    loadError,
    toast,
    setToast,
    busy,
    trace: run?.trace ?? [],
    summary: run?.summary ?? null,
    round,
    reload: () => refresh(false),
    runAgent,
    simulateSales,
    simulateRogue,
    resetDemo,
    poAction,
  };
}
