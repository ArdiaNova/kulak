import { z } from "zod";

import type { ToolContext, ToolOutcome } from "@/lib/agent.types";
import { ExecutorError } from "@/lib/executor";
import { buildGuardInput } from "@/lib/executor.shared";
import { evaluatePO } from "@/lib/guard";
import { OPEN_PO_STATUSES, daysLeft, round2, weekSpent } from "@/lib/metrics";
import { POError, createPO } from "@/lib/po";
import type { Item } from "@/lib/types";

/** The six tools. Arguments are validated here, never by the model. */

const emptyArgs = z.object({});
const quoteArgs = z
  .object({
    itemId: z.string().min(1).optional(),
    itemIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  })
  .refine((args) => Boolean(args.itemId) || Boolean(args.itemIds?.length), {
    message: "Send itemId or itemIds.",
  });
const lineArgs = z.object({
  itemId: z.string().min(1),
  qty: z.number().gt(0).max(100_000),
});
const createArgs = z.object({
  supplierId: z.string().min(1),
  lines: z.array(lineArgs).min(1).max(20),
  rationale: z.string().trim().min(1).max(300),
});
const submitArgs = z.object({ poId: z.string().min(1) });

function invalid(name: string, error: z.ZodError): ToolOutcome {
  return {
    ok: false,
    result: {
      error: `Invalid arguments for ${name}.`,
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  };
}

function toToolError(error: unknown): { error: string; message: string } {
  if (error instanceof POError || error instanceof ExecutorError) {
    return { error: error.code, message: error.message };
  }
  return {
    error: "TOOL_ERROR",
    message: error instanceof Error ? error.message : "Unknown tool error.",
  };
}

async function tool<S extends z.ZodType>(
  name: string,
  schema: S,
  raw: unknown,
  run: (args: z.infer<S>) => Promise<unknown>,
): Promise<ToolOutcome> {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return invalid(name, parsed.error);
  try {
    return { ok: true, result: await run(parsed.data) };
  } catch (error) {
    return { ok: false, result: toToolError(error) };
  }
}

const priceChange = (unitPrice: number, lastPaid: number | null): number | null =>
  lastPaid && lastPaid > 0
    ? Math.round((unitPrice / lastPaid - 1) * 1000) / 10
    : null;

function findItem(items: Item[], key: string): Item | undefined {
  return items.find((item) => item.id === key) ?? items.find((item) => item.sku === key);
}

const HANDLERS: Record<string, (raw: unknown, ctx: ToolContext) => Promise<ToolOutcome>> = {
  get_mandate: (raw, ctx) =>
    tool("get_mandate", emptyArgs, raw, async () => {
      const [mandate, pos] = await Promise.all([ctx.repo.getMandate(), ctx.repo.listPOs()]);
      const spent = weekSpent(pos, ctx.now);
      return {
        mode: mandate.mode,
        currency: mandate.currency,
        weeklyBudget: mandate.weeklyBudget,
        autoApproveCap: mandate.autoApproveCap,
        hardBlockCap: mandate.hardBlockCap,
        maxQtyMultiple: mandate.maxQtyMultiple,
        maxPriceSpikePct: mandate.maxPriceSpikePct,
        weekSpent: spent,
        remaining: round2(mandate.weeklyBudget - spent),
      };
    }),

  get_inventory: (raw, ctx) =>
    tool("get_inventory", emptyArgs, raw, async () => {
      const items = await ctx.repo.listItems();
      return {
        items: items.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          stock: item.stock,
          reorderPoint: item.reorderPoint,
          avgDailyUse: item.avgDailyUse,
          daysLeft: daysLeft(item),
        })),
      };
    }),

  get_open_purchase_orders: (raw, ctx) =>
    tool("get_open_purchase_orders", emptyArgs, raw, async () => {
      const [pos, suppliers, items] = await Promise.all([
        ctx.repo.listPOs(),
        ctx.repo.listSuppliers(),
        ctx.repo.listItems(),
      ]);
      const supplierName = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
      const sku = new Map(items.map((item) => [item.id, item.sku]));

      return {
        purchaseOrders: pos
          .filter((po) => OPEN_PO_STATUSES.includes(po.status))
          .map((po) => ({
            id: po.id,
            supplierId: po.supplierId,
            supplierName: supplierName.get(po.supplierId) ?? "unknown supplier",
            status: po.status,
            total: po.total,
            ageHours:
              Math.round(((ctx.now.getTime() - po.createdAt.getTime()) / 3_600_000) * 10) / 10,
            items: (po.lines ?? []).map((line) => ({
              sku: sku.get(line.itemId) ?? line.itemId,
              qty: line.qty,
            })),
          })),
      };
    }),

  get_supplier_quotes: (raw, ctx) =>
    tool("get_supplier_quotes", quoteArgs, raw, async (args) => {
      const [items, quotes, suppliers] = await Promise.all([
        ctx.repo.listItems(),
        ctx.repo.listQuotes(),
        ctx.repo.listSuppliers(),
      ]);

      const wanted = args.itemIds ?? (args.itemId ? [args.itemId] : []);
      const picked = wanted.map((key) => {
        const item = findItem(items, key);
        if (!item) throw new Error(`Unknown itemId: ${key}`);
        return item;
      });

      const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
      return {
        items: picked.map((item) => ({
          item: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            stock: item.stock,
            daysLeft: daysLeft(item),
          },
          quotes: quotes
            .filter((quote) => quote.itemId === item.id)
            .map((quote) => {
              const supplier = supplierById.get(quote.supplierId);
              return {
                supplierId: quote.supplierId,
                supplierName: supplier?.name ?? "unknown supplier",
                approved: supplier?.approved ?? false,
                unitPrice: quote.unitPrice,
                lastPaidPrice: quote.lastPaidPrice,
                priceChangePct: priceChange(quote.unitPrice, quote.lastPaidPrice),
                moq: quote.moq,
                leadDays: quote.leadDays,
              };
            }),
        })),
      };
    }),

  create_purchase_order: (raw, ctx) =>
    tool("create_purchase_order", createArgs, raw, async (args) => {
      // createPO reads prices from supplier_quotes; model-sent prices never reach it.
      const po = await createPO(ctx.repo, {
        supplierId: args.supplierId,
        lines: args.lines,
        rationale: args.rationale,
        createdBy: "agent",
      });

      const [mandate, suppliers, quotes, items, pos] = await Promise.all([
        ctx.repo.getMandate(),
        ctx.repo.listSuppliers(),
        ctx.repo.listQuotes(),
        ctx.repo.listItems(),
        ctx.repo.listPOs(),
      ]);
      const guard = evaluatePO(
        buildGuardInput({ po, mandate, suppliers, quotes, items, pos, now: ctx.now }),
      );

      return {
        poId: po.id,
        supplierId: po.supplierId,
        total: po.total,
        currency: po.currency,
        lines: (po.lines ?? []).map((line) => ({
          itemId: line.itemId,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
        guard: {
          decision: guard.decision,
          reasons: guard.reasons.map((reason) => ({
            code: reason.code,
            severity: reason.severity,
            message: reason.message,
          })),
        },
      };
    }),

  submit_purchase_order: (raw, ctx) =>
    tool("submit_purchase_order", submitArgs, raw, async (args) => {
      const result = await ctx.executor.submitPO(args.poId);
      return {
        poId: result.poId,
        status: result.status,
        decision: result.decision,
        reasons: result.reasons,
        batchId: result.batchId ?? null,
      };
    }),
};

export function toolNames(): string[] {
  return Object.keys(HANDLERS);
}

export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const handler = HANDLERS[name];
  if (!handler) return { ok: false, result: { error: `Unknown tool: ${name}` } };
  return handler(rawArgs, ctx);
}
