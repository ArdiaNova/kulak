"use client";

import type { AgentTraceEntry } from "@/components/types";

/** Thin fetch helpers shared by the dashboard hooks. */

export async function messageFrom(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message ?? `Request failed (${response.status}).`;
}

export async function send(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await messageFrom(response));
  return response.json().catch(() => null);
}

export type AgentRunBody = {
  trace: AgentTraceEntry[];
  summary: string;
  purchaseOrders: unknown[];
};

export type StreamEvent =
  | { type: "round"; iteration: number }
  | { type: "tool"; entry: AgentTraceEntry }
  | { type: "done"; result: AgentRunBody }
  | { type: "error"; message: string };

/** Read the server-sent events from POST /api/agent/stream as they arrive. */
export async function streamAgent(
  onEvent: (event: StreamEvent) => void,
): Promise<AgentRunBody> {
  const response = await fetch("/api/agent/stream", { method: "POST", cache: "no-store" });
  if (!response.ok || !response.body) throw new Error(await messageFrom(response));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished: AgentRunBody | null = null;
  let failure: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const line = block.split("\n").find((candidate) => candidate.startsWith("data:"));
      if (!line) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        continue;
      }
      if (event.type === "error") {
        failure = event.message;
        continue;
      }
      if (event.type === "done") finished = event.result;
      onEvent(event);
    }
  }

  if (!finished) throw new Error(failure ?? "The agent stream ended before the run finished.");
  return finished;
}
