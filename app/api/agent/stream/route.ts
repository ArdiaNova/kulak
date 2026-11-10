import { runAgent } from "@/lib/agent";
import { createOpenAIModel } from "@/lib/agent.model";
import type { AgentStreamEvent } from "@/lib/agent.types";
import { getExecutor, getRepo } from "@/lib/runtime";

/**
 * Same run as POST /api/agent/run, streamed as server-sent events so the
 * dashboard can show every tool call while the model is still working.
 * Event types are in lib/agent.types.ts. Errors travel inside the stream
 * because the HTTP status is already 200 by then.
 */
export const maxDuration = 300;

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: AgentStreamEvent | { type: "error"; message: string }) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The client disconnected; the run still finishes and writes its rows.
          open = false;
        }
      };

      try {
        // runAgent emits its own `done` event with the full result.
        await runAgent(
          { repo: getRepo(), executor: getExecutor(), model: createOpenAIModel() },
          { onEvent: send },
        );
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "The agent run failed.",
        });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
