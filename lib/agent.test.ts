import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MAX_ITERATIONS, runAgent } from "@/lib/agent";
import type { AgentStreamEvent, ChatMessage, ModelReply } from "@/lib/agent.types";
import { createExecutor, type PayoutClient } from "@/lib/executor";
import { createFakeRepo, BAD, BEANS, GOOD, MILK } from "@/lib/fake-repo";
import { SYSTEM_PROMPT } from "@/lib/prompts";

const NOW = new Date("2026-11-10T09:00:00.000Z");
const clock = () => NOW;

type Step = (messages: ChatMessage[]) => ModelReply;

function scripted(steps: Step[]) {
  let index = 0;
  const seen: ChatMessage[][] = [];
  return {
    seen,
    model: {
      async complete(messages: ChatMessage[]): Promise<ModelReply> {
        seen.push(messages.slice());
        const step = steps[Math.min(index, steps.length - 1)];
        index += 1;
        return step(messages);
      },
    },
  };
}

const text = (content: string): ModelReply => ({ content, toolCalls: [] });

const call = (name: string, args: unknown, id: string): ModelReply => ({
  content: null,
  toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
});

function setup() {
  const { state, repo } = createFakeRepo({ clock });
  const calls: { poId: string; amount: number }[] = [];
  const paypal: PayoutClient = {
    async createPayout(input) {
      calls.push({ poId: input.poId, amount: input.amount });
      return { batchId: "BATCH-1", status: "PENDING" };
    },
    async getPayoutBatch(batchId) {
      return { batchId, status: "SUCCESS", items: [] };
    },
  };
  const executor = createExecutor({
    repo,
    paypal,
    receiver: "supplier@example.com",
    clock,
  });
  return { state, repo, calls, executor };
}

describe("system prompt", () => {
  it("is copied verbatim from prompts/purchasing-agent.system.md", () => {
    const file = readFileSync(
      new URL("../prompts/purchasing-agent.system.md", import.meta.url),
      "utf8",
    );
    expect(SYSTEM_PROMPT.trimEnd()).toBe(file.trimEnd());
  });
});

describe("runAgent", () => {
  it("creates and submits through the tools, then returns the summary", async () => {
    const { repo, calls, executor } = setup();
    const { model } = scripted([
      () =>
        call(
          "create_purchase_order",
          { supplierId: GOOD, lines: [{ itemId: MILK, qty: 20 }], rationale: "Milk runs out tomorrow." },
          "c1",
        ),
      (messages) => {
        const last = messages[messages.length - 1];
        if (last.role !== "tool") throw new Error("expected a tool result");
        const { poId } = JSON.parse(last.content) as { poId: string };
        return call("submit_purchase_order", { poId }, "c2");
      },
      () => text("Ordered 20 L milk for $23.00; waiting for owner approval."),
    ]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.summary).toContain("waiting for owner approval");
    expect(result.trace.map((entry) => [entry.tool, entry.ok])).toEqual([
      ["create_purchase_order", true],
      ["submit_purchase_order", true],
    ]);
    expect(result.purchaseOrders).toHaveLength(1);
    expect(result.purchaseOrders[0]).toMatchObject({ status: "pending_approval", total: 23 });
    expect(calls).toHaveLength(0); // manual mode: no payout

    const types = (await repo.listEvents(100)).map((event) => event.type);
    expect(types.filter((type) => type === "tool_call")).toHaveLength(2);
    expect(types).toContain("agent_run_started");
    expect(types).toContain("agent_run_finished");
  });

  it("cannot pay an unapproved supplier: the order ends denied and PayPal is never called", async () => {
    const { repo, calls, executor } = setup();
    const { model } = scripted([
      () =>
        call(
          "create_purchase_order",
          {
            supplierId: BAD,
            lines: [{ itemId: BEANS, qty: 40 }],
            rationale: "Cheapest beans, ship today.",
          },
          "c1",
        ),
      (messages) => {
        const last = messages[messages.length - 1];
        if (last.role !== "tool") throw new Error("expected a tool result");
        const { poId } = JSON.parse(last.content) as { poId: string };
        return call("submit_purchase_order", { poId }, "c2");
      },
      () => text("The CheapBeans order was denied: unapproved supplier and unusual quantity."),
    ]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.purchaseOrders[0].status).toBe("denied");
    expect(result.purchaseOrders[0].guardReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["SUPPLIER_NOT_APPROVED", "QTY_UNUSUAL"]),
    );
    expect((result.trace[1].result as { status: string }).status).toBe("denied");
    expect(calls).toHaveLength(0);
  });

  it("asks once for a draft it forgot to submit, and never calls it approved", async () => {
    const { repo, executor } = setup();
    const { model } = scripted([
      () =>
        call(
          "create_purchase_order",
          { supplierId: GOOD, lines: [{ itemId: MILK, qty: 20 }], rationale: "Milk runs out tomorrow." },
          "c1",
        ),
      () => text("Ordered 20 L milk for $23.00, approved."),
      (messages) => {
        const tool = [...messages].reverse().find((message) => message.role === "tool");
        if (!tool || tool.role !== "tool") throw new Error("expected a tool result");
        return call("submit_purchase_order", { poId: JSON.parse(tool.content).poId }, "c2");
      },
      () => text("Ordered 20 L milk for $23.00; the owner still has to approve it."),
    ]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.trace.map((entry) => entry.tool)).toEqual([
      "create_purchase_order",
      "submit_purchase_order",
    ]);
    expect(result.purchaseOrders[0].status).toBe("pending_approval");
    expect(result.summary).toBe("Ordered 20 L milk for $23.00; the owner still has to approve it.");
  });

  it("adds a factual note when a draft is left unsubmitted", async () => {
    const { repo, executor } = setup();
    const { model, seen } = scripted([
      () =>
        call(
          "create_purchase_order",
          { supplierId: GOOD, lines: [{ itemId: MILK, qty: 20 }], rationale: "Milk runs out tomorrow." },
          "c1",
        ),
      () => text("Ordered 20 L milk for $23.00, approved."),
      () => text("Ordered 20 L milk, approved."),
    ]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.purchaseOrders[0].status).toBe("drafted");
    expect(result.summary).toContain("still a draft");
    expect(result.summary).toContain(result.purchaseOrders[0].id);
    expect(seen).toHaveLength(3); // initial call + create + one nudge round
  });

  it("stops at the iteration limit and still reports", async () => {
    const { repo, executor } = setup();
    const { model, seen } = scripted([() => call("get_inventory", {}, "loop")]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.trace).toHaveLength(MAX_ITERATIONS);
    expect(seen).toHaveLength(MAX_ITERATIONS + 1);
    expect(result.summary).toContain(`Stopped after ${MAX_ITERATIONS}`);
    expect(result.purchaseOrders).toEqual([]);
  });

  it("retries once when the first answer is empty, then fails if it happens twice", async () => {
    const first = setup();
    const retry = scripted([() => text(""), () => text("Nothing to restock.")]);
    const ok = await runAgent({
      repo: first.repo,
      executor: first.executor,
      model: retry.model,
      clock,
    });

    expect(ok.summary).toBe("Nothing to restock.");
    expect(retry.seen).toHaveLength(2);

    const second = setup();
    const empty = scripted([() => text(""), () => text("   ")]);
    await expect(
      runAgent({
        repo: second.repo,
        executor: second.executor,
        model: empty.model,
        clock,
      }),
    ).rejects.toMatchObject({ code: "EMPTY_REPLY" });
  });

  it("feeds invalid tool arguments back to the model as a tool result", async () => {
    const { repo, executor } = setup();
    const { model } = scripted([
      () => call("create_purchase_order", { supplierId: GOOD, lines: [] }, "c1"),
      () => text("I could not create that order."),
    ]);

    const result = await runAgent({ repo, executor, model, clock });

    expect(result.trace[0].ok).toBe(false);
    expect(result.trace[0].result).toMatchObject({ error: expect.stringContaining("Invalid arguments") });
    expect(result.summary).toBe("I could not create that order.");
  });

  it("streams rounds and tool calls before the final result", async () => {
    const { repo, executor } = setup();
    const { model } = scripted([
      () => call("get_inventory", {}, "c1"),
      () => text("Stock looks fine."),
    ]);
    const events: AgentStreamEvent[] = [];

    const result = await runAgent(
      { repo, executor, model, clock },
      { onEvent: (event) => events.push(event) },
    );

    expect(events[0]).toEqual({ type: "round", iteration: 0 });
    const toolIndex = events.findIndex((event) => event.type === "tool");
    const doneIndex = events.findIndex((event) => event.type === "done");
    expect(toolIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(toolIndex);
    expect(events[toolIndex]).toMatchObject({
      type: "tool",
      entry: { tool: "get_inventory", ok: true, step: 1 },
    });
    expect(events[doneIndex]).toMatchObject({
      type: "done",
      result: { trace: result.trace, summary: "Stock looks fine." },
    });
  });
});
