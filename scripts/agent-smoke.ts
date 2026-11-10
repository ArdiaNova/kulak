import { runAgent } from "@/lib/agent";
import { createOpenAIModel } from "@/lib/agent.model";
import { getExecutor, getRepo } from "@/lib/runtime";

/**
 * Dev-only: run the agent directly, with the real LLM, outside the web server.
 * Node 20 needs --experimental-websocket for supabase-js realtime, e.g.
 *   node --conditions=react-server --experimental-websocket \
 *     --env-file=.env.local --import tsx scripts/agent-smoke.ts
 */
async function main() {
  const started = Date.now();
  try {
    const result = await runAgent({
      repo: getRepo(),
      executor: getExecutor(),
      model: createOpenAIModel(),
    });
    console.log(
      JSON.stringify(
        {
          ms: Date.now() - started,
          summary: result.summary,
          trace: result.trace.map((entry) => ({
            step: entry.step,
            tool: entry.tool,
            ok: entry.ok,
            ms: entry.durationMs,
          })),
          purchaseOrders: result.purchaseOrders.map((po) => ({
            status: po.status,
            total: po.total,
            guard: po.guardDecision,
            reasons: po.guardReasons.map((reason) => reason.code),
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`FAILED after ${Date.now() - started} ms`);
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
