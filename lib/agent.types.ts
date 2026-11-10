import type { Executor } from "@/lib/executor";
import type { Repo } from "@/lib/repo";
import type { GuardDecision, POStatus, Reason } from "@/lib/types";

/** Types for the runtime agent. No SDK types leak past lib/agent.model.ts. */

export type ModelToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ModelToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ModelReply = {
  content: string | null;
  toolCalls: ModelToolCall[];
};

/** JSON-schema wrapper for one tool, as the model sees it. */
export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** The one thing lib/agent.ts needs from the provider. Fake in tests. */
export type Model = {
  complete(messages: ChatMessage[], tools: ToolSchema[]): Promise<ModelReply>;
};

export type ToolContext = {
  repo: Repo;
  executor: Executor;
  now: Date;
};

export type ToolOutcome = {
  ok: boolean;
  result: unknown;
};

export type TraceEntry = {
  step: number;
  iteration: number;
  tool: string;
  args: unknown;
  ok: boolean;
  result: unknown;
  durationMs: number;
};

export type AgentPurchaseOrder = {
  id: string;
  supplierId: string;
  status: POStatus;
  total: number;
  rationale: string | null;
  guardDecision: GuardDecision | null;
  guardReasons: Reason[];
};

export type AgentResult = {
  trace: TraceEntry[];
  summary: string;
  purchaseOrders: AgentPurchaseOrder[];
};

export type AgentDeps = {
  repo: Repo;
  executor: Executor;
  model: Model;
  clock?: () => Date;
};

export class AgentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}
