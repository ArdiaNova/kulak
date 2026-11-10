import type { ToolSchema } from "@/lib/agent.types";

/** JSON schema for the six tools. Descriptions tell the model the workflow. */

const noArgs = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "get_mandate",
    description:
      "Read the owner's spending mandate: mode (manual or auto), weekly budget, caps and how much of the weekly budget is already spent. Read-only.",
    parameters: noArgs,
  },
  {
    name: "get_inventory",
    description:
      "List every café item with its id, sku, stock, reorder point, average daily use and days of stock left.",
    parameters: noArgs,
  },
  {
    name: "get_open_purchase_orders",
    description:
      "List purchase orders that are still open (pending approval, approved, paying or paid), with supplier, quantities and age in hours. Use this so you do not order the same item twice.",
    parameters: noArgs,
  },
  {
    name: "get_supplier_quotes",
    description:
      "List supplier quotes for the items you selected, all in one call: pass every item id as itemIds. For each item you get supplier id and name, whether the supplier is approved, unit price, last paid price, price change percent, minimum order quantity and lead days. Call this before choosing a supplier.",
    parameters: {
      type: "object",
      properties: {
        itemIds: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { type: "string" },
          description:
            "Ids of every selected item, taken from get_inventory. Pass all of them in one call.",
        },
        itemId: {
          type: "string",
          description: "Single item id, only if you need one item.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_purchase_order",
    description:
      "Create a draft purchase order. Send items and quantities only: unit prices and the total are looked up server-side from supplier quotes, and any price you send is ignored. Returns the new po id, the server-computed total and a guard preview (approve, escalate or deny with reasons).",
    parameters: {
      type: "object",
      properties: {
        supplierId: {
          type: "string",
          description: "Supplier id from get_supplier_quotes. Never an unapproved supplier.",
        },
        lines: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              qty: { type: "number", exclusiveMinimum: 0 },
            },
            required: ["itemId", "qty"],
            additionalProperties: false,
          },
        },
        rationale: {
          type: "string",
          maxLength: 300,
          description: "One sentence: cost, lead time, why this supplier.",
        },
      },
      required: ["supplierId", "lines", "rationale"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_purchase_order",
    description:
      "Submit a draft purchase order to the mandate. The guard is authoritative: it may pay it, hold it for the owner, or deny it. Returns the final status and the guard reasons. Do not retry a denied or escalated order.",
    parameters: {
      type: "object",
      properties: {
        poId: { type: "string", description: "The po id returned by create_purchase_order." },
      },
      required: ["poId"],
      additionalProperties: false,
    },
  },
];
