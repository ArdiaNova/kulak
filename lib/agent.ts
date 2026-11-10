import { TOOL_SCHEMAS } from "@/lib/agent.schemas";
import { executeTool } from "@/lib/agent.tools";
import {
  AgentError,
  type AgentDeps,
  type AgentPurchaseOrder,
  type AgentResult,
  type ChatMessage,
  type ModelReply,
  type ToolOutcome,
  type TraceEntry,
} from "@/lib/agent.types";
import { SYSTEM_PROMPT, USER_PROMPT } from "@/lib/prompts";

/**
 * The tool loop. The model chooses tools; every argument is validated in
 * lib/agent.tools.ts; submit_purchase_order goes through the executor, so the
 * guard stays authoritative. Nothing here can move money on its own.
 */

/**
 * The prompt forces 3 reads + one quote call per low item + one create per
 * supplier + one submit per draft + a summary round. With six low items that is
 * 13 rounds, so the limit is 14. A larger number only buys the model more room
 * to loop without acting.
 */
export const MAX_ITERATIONS = 14;

/** After this many rounds, tell the model how many rounds it has left. */
const BUDGET_NOTE_AT = MAX_ITERATIONS - 5;

function budgetNote(used: number): string {
  return `Tool budget: ${MAX_ITERATIONS - used} of ${MAX_ITERATIONS} rounds left. Stop calling read tools. Create the purchase orders you can already justify, call submit_purchase_order for every draft, then write the summary for the owner.`;
}

function summaryFallback(stopped: "summary" | "iteration_limit", calls: number): string {
  if (stopped === "iteration_limit") {
    return `Stopped after ${MAX_ITERATIONS} rounds of tool calls without a final summary (${calls} tool calls recorded).`;
  }
  return "The agent finished without a summary.";
}

/** One factual line so the summary can never call an unsubmitted order approved. */
function withDraftNote(summary: string, drafts: string[]): string {
  if (drafts.length === 0) return summary;
  return `${summary}\n\nNote: ${drafts.length === 1 ? "this order is" : "these orders are"} still a draft and ${drafts.length === 1 ? "was" : "were"} not submitted: ${drafts.join(", ")}.`;
}

async function draftsOf(repo: AgentDeps["repo"], poIds: string[]): Promise<string[]> {
  const drafts: string[] = [];
  for (const poId of poIds) {
    const po = await repo.getPO(poId);
    if (po?.status === "drafted") drafts.push(po.id);
  }
  return drafts;
}

function draftNote(drafts: string[]): string {
  return `You created these purchase orders but never submitted them: ${drafts.join(", ")}. Call submit_purchase_order for each of them, or explain why you are leaving them as drafts. Do not describe a draft as approved.`;
}

function tooMany(): never {
  throw new AgentError("EMPTY_REPLY", "The model returned no tool calls and no summary twice.");
}

export async function runAgent(deps: AgentDeps): Promise<AgentResult> {
  const clock = deps.clock ?? (() => new Date());
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: USER_PROMPT },
  ];

  await deps.repo.insertEvent({ actor: "agent", type: "agent_run_started", detail: {} });

  // Rule: retry once if the first answer has neither tool calls nor a summary.
  let reply: ModelReply = await deps.model.complete(messages, TOOL_SCHEMAS);
  if (reply.toolCalls.length === 0 && !(reply.content ?? "").trim()) {
    reply = await deps.model.complete(messages, TOOL_SCHEMAS);
    if (reply.toolCalls.length === 0 && !(reply.content ?? "").trim()) tooMany();
  }

  const trace: TraceEntry[] = [];
  const poIds: string[] = [];
  let iterations = 0;
  let stopped: "summary" | "iteration_limit" = "summary";
  let budgetNoted = false;
  let nudged = false;

  for (;;) {
    if (reply.toolCalls.length === 0) {
      // The prompt says to submit every draft. Ask once if the model stops early.
      const drafts = nudged ? [] : await draftsOf(deps.repo, poIds);
      if (drafts.length > 0 && iterations < MAX_ITERATIONS) {
        nudged = true;
        iterations += 1;
        messages.push({ role: "assistant", content: reply.content });
        messages.push({ role: "user", content: draftNote(drafts) });
        reply = await deps.model.complete(messages, TOOL_SCHEMAS);
        continue;
      }
      break;
    }
    if (iterations >= MAX_ITERATIONS) {
      stopped = "iteration_limit";
      break;
    }
    iterations += 1;

    messages.push({
      role: "assistant",
      content: reply.content,
      toolCalls: reply.toolCalls,
    });

    // Sequential on purpose: a submit must never race the create it depends on.
    for (const call of reply.toolCalls) {
      const started = Date.now();
      const context = { repo: deps.repo, executor: deps.executor, now: clock() };

      let args: unknown = null;
      let outcome: ToolOutcome;
      try {
        args = JSON.parse(call.arguments || "{}");
        outcome = await executeTool(call.name, args, context);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        args = call.arguments;
        outcome = { ok: false, result: { error: "Tool arguments were not valid JSON." } };
      }

      const entry: TraceEntry = {
        step: trace.length + 1,
        iteration: iterations,
        tool: call.name,
        args,
        ok: outcome.ok,
        result: outcome.result,
        durationMs: Date.now() - started,
      };
      trace.push(entry);

      await deps.repo.insertEvent({
        actor: "agent",
        type: "tool_call",
        detail: { ...entry },
      });

      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(outcome.result),
      });

      if (outcome.ok) {
        const poId = (outcome.result as { poId?: unknown }).poId;
        if (typeof poId === "string" && !poIds.includes(poId)) poIds.push(poId);
      }
    }

    if (!budgetNoted && iterations >= BUDGET_NOTE_AT) {
      // A user-role nudge keeps providers that only allow a system prompt first.
      messages.push({ role: "user", content: budgetNote(iterations) });
      budgetNoted = true;
    }

    reply = await deps.model.complete(messages, TOOL_SCHEMAS);
  }

  const purchaseOrders: AgentPurchaseOrder[] = [];
  for (const poId of poIds) {
    const po = await deps.repo.getPO(poId);
    if (!po) continue;
    purchaseOrders.push({
      id: po.id,
      supplierId: po.supplierId,
      status: po.status,
      total: po.total,
      rationale: po.rationale,
      guardDecision: po.guardDecision,
      guardReasons: po.guardReasons,
    });
  }

  const summary = withDraftNote(
    (reply.content ?? "").trim() || summaryFallback(stopped, trace.length),
    purchaseOrders.filter((po) => po.status === "drafted").map((po) => po.id),
  );

  await deps.repo.insertEvent({
    actor: "agent",
    type: "agent_run_finished",
    detail: {
      stopped,
      iterations,
      summary,
      purchaseOrders: purchaseOrders.map((po) => ({
        id: po.id,
        status: po.status,
        total: po.total,
      })),
    },
  });

  return { trace, summary, purchaseOrders };
}
