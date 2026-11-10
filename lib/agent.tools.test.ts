import { describe, expect, it } from "vitest";

import { executeTool } from "@/lib/agent.tools";
import { createExecutor, type PayoutClient } from "@/lib/executor";
import { createFakeRepo, BAD, BEANS, GOOD, MILK } from "@/lib/fake-repo";

const NOW = new Date("2026-11-10T09:00:00.000Z");
const clock = () => NOW;

type CreateResult = {
  poId: string;
  total: number;
  lines: { itemId: string; qty: number; unitPrice: number }[];
  guard: { decision: string };
};

function setup() {
  const { repo } = createFakeRepo({ clock });
  const paypal: PayoutClient = {
    async createPayout() {
      throw new Error("PayPal must not be called from a tool test");
    },
    async getPayoutBatch() {
      throw new Error("PayPal must not be called from a tool test");
    },
  };
  const executor = createExecutor({ repo, paypal, receiver: "supplier@example.com", clock });
  return { repo, ctx: { repo, executor, now: NOW } };
}

describe("executeTool", () => {
  it("rejects an unknown tool without throwing", async () => {
    const { ctx } = setup();

    const outcome = await executeTool("delete_everything", {}, ctx);

    expect(outcome.ok).toBe(false);
    expect(outcome.result).toMatchObject({ error: "Unknown tool: delete_everything" });
  });

  it("rejects bad arguments with the offending path, without throwing", async () => {
    const { ctx } = setup();

    const outcome = await executeTool(
      "create_purchase_order",
      { supplierId: GOOD, lines: [{ itemId: MILK, qty: "twenty" }], rationale: "Restock." },
      ctx,
    );

    expect(outcome.ok).toBe(false);
    const result = outcome.result as { error: string; issues: { path: string }[] };
    expect(result.error).toContain("Invalid arguments");
    expect(result.issues[0].path).toBe("lines.0.qty");
  });

  it("ignores prices and totals sent by the model", async () => {
    const { ctx } = setup();

    const outcome = await executeTool(
      "create_purchase_order",
      {
        supplierId: GOOD,
        lines: [{ itemId: MILK, qty: 20, unitPrice: 0.01 }],
        rationale: "Milk is nearly out.",
        total: 0.2,
      },
      ctx,
    );

    expect(outcome.ok).toBe(true);
    const result = outcome.result as CreateResult;
    expect(result.total).toBe(23); // 20 * 1.15 from supplier_quotes
    expect(result.lines[0].unitPrice).toBe(1.15);
    expect(result.guard.decision).toBe("approve");
  });

  it("quotes several items in one call, with approval and price change", async () => {
    const { ctx } = setup();

    const outcome = await executeTool("get_supplier_quotes", { itemIds: [BEANS, MILK] }, ctx);
    expect(outcome.ok).toBe(true);

    const result = outcome.result as {
      items: { item: { id: string }; quotes: { supplierId: string; approved: boolean; priceChangePct: number | null }[] }[];
    };
    expect(result.items).toHaveLength(2);

    const beans = result.items.find((entry) => entry.item.id === BEANS);
    const good = beans?.quotes.find((quote) => quote.supplierId === GOOD);
    const bad = beans?.quotes.find((quote) => quote.supplierId === BAD);

    expect(good).toMatchObject({ approved: true, priceChangePct: 20.8 }); // 14.5 vs 12.00
    expect(bad).toMatchObject({ approved: false, priceChangePct: null });
    expect(result.items.some((entry) => entry.item.id === MILK)).toBe(true);
  });

  it("returns an error result for an unknown item id", async () => {
    const { ctx } = setup();

    const outcome = await executeTool("get_supplier_quotes", { itemId: "item-nope" }, ctx);

    expect(outcome.ok).toBe(false);
    expect((outcome.result as { message: string }).message).toContain("Unknown itemId");
  });

  it("reports inventory with days left and the mandate with remaining budget", async () => {
    const { ctx } = setup();

    const inventory = await executeTool("get_inventory", {}, ctx);
    const items = (inventory.result as { items: { sku: string; daysLeft: number }[] }).items;
    expect(items.find((item) => item.sku === "MILK-WHL")).toMatchObject({ daysLeft: 1.6 });

    const mandate = await executeTool("get_mandate", {}, ctx);
    expect(mandate.result).toMatchObject({
      mode: "manual",
      weeklyBudget: 600,
      weekSpent: 0,
      remaining: 600,
    });
  });

  it("turns an executor error into a tool result the model can read", async () => {
    const { ctx } = setup();

    const outcome = await executeTool("submit_purchase_order", { poId: "po-missing" }, ctx);

    expect(outcome.ok).toBe(false);
    expect(outcome.result).toMatchObject({ error: "PO_NOT_FOUND" });
  });
});
