"use client";

import { useEffect, useRef, useState } from "react";

import type { AgentTraceEntry } from "@/components/types";
import { Card, Chip } from "@/components/ui";

function compact(value: unknown, limit = 90): string {
  const text = JSON.stringify(value ?? null) ?? "null";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * The agent's work, step by step. The summary is the model's own words; the
 * steps come from our loop, so the product can be audited without trusting the
 * prose.
 *
 * The panel has a fixed height and scrolls inside itself: a run streams 10+ tool
 * calls, and it is placed last on the page so no card below it can be pushed
 * around while the model works.
 */
export function AgentTrace({
  trace,
  summary,
  running,
  round,
}: {
  trace: AgentTraceEntry[];
  summary: string | null;
  running: boolean;
  round: number;
}) {
  const totalMs = trace.reduce((sum, entry) => sum + entry.durationMs, 0);
  const [open, setOpen] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);

  // While a run is streaming, keep the newest step in view; when it finishes,
  // jump back to the top so the model's summary is the first thing you read.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = running ? node.scrollHeight : 0;
  }, [running, trace.length, round]);

  const untouched = !summary && !running && trace.length === 0;

  return (
    <Card
      title="Agent trace"
      hint="The model's real tool calls, streamed live. The summary is its own words."
      action={
        <span className="text-xs text-neutral-500">
          {running
            ? `round ${Math.max(round, 1)} · ${trace.length} calls`
            : `${trace.length} tool calls · ${(totalMs / 1000).toFixed(1)}s`}
        </span>
      }
    >
      <div ref={scroller} className="h-[340px] overflow-y-auto">
        {untouched ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-500">
            No run yet in this session. Press “Run agent” to see its steps.
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {running && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <span className="size-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Round {Math.max(round, 1)}: the model is planning, reading stock and talking to
                suppliers…
              </div>
            )}

            {summary && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  Final summary
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-800">
                  {summary}
                </p>
              </div>
            )}

            {trace.length > 0 && (
              <div className="rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  aria-expanded={open}
                >
                  {open ? "Hide" : "Show"} {trace.length} tool calls
                </button>
                {open && (
                  <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {trace.map((entry) => (
                      <li key={entry.step} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-[11px] tabular-nums text-neutral-400">
                            #{entry.step}
                          </span>
                          <span className="font-mono text-xs text-neutral-900">{entry.tool}</span>
                          <Chip tone={entry.ok ? "ok" : "critical"}>
                            {entry.ok ? "ok" : "failed"}
                          </Chip>
                          <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
                            {entry.durationMs} ms
                          </span>
                        </div>
                        <p className="mt-1 break-all pl-8 font-mono text-[11px] text-neutral-500">
                          {compact(entry.args)}
                        </p>
                        <p className="break-all pl-8 font-mono text-[11px] text-neutral-400">
                          → {compact(entry.result)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
