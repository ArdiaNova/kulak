import { describe, expect, it } from "vitest";

import { rows, toEvent, toItem, toMandate, toPO, toQuote, toSupplier } from "@/lib/rows";

/** Supabase returns numeric columns as strings; these mappers must absorb that. */

describe("row mappers", () => {
  it("parses numeric strings and timestamps for an item", () => {
    expect(
      toItem({
        id: "i1",
        sku: "MILK-WHL",
        name: "Whole milk",
        unit: "L",
        stock: "14.000",
        reorder_point: "30",
        avg_daily_use: "9",
        created_at: "2026-11-01T08:00:00.000Z",
      }),
    ).toMatchObject({
      stock: 14,
      reorderPoint: 30,
      avgDailyUse: 9,
      createdAt: new Date("2026-11-01T08:00:00.000Z"),
    });
  });

  it("treats a supplier as approved only when the column is true", () => {
    expect(toSupplier({ id: "s1", name: "Bean & Co", approved: true })).toMatchObject({
      approved: true,
      notes: null,
    });
    expect(toSupplier({ id: "s2", name: "CheapBeans", approved: false }).approved).toBe(false);
  });

  it("keeps a missing last paid price null and defaults the moq", () => {
    expect(
      toQuote({
        id: "q1",
        supplier_id: "s1",
        item_id: "i1",
        unit_price: "14.500",
        last_paid_price: null,
        lead_days: "3",
      }),
    ).toMatchObject({ unitPrice: 14.5, lastPaidPrice: null, moq: 1, leadDays: 3 });
  });

  it("parses a mandate row", () => {
    expect(
      toMandate({
        id: 1,
        mode: "manual",
        currency: "USD",
        weekly_budget: "450.00",
        auto_approve_cap: "200.00",
        hard_block_cap: "600.00",
        max_qty_multiple: "2.5",
        max_price_spike_pct: "20",
      }),
    ).toMatchObject({ weeklyBudget: 450, autoApproveCap: 200, hardBlockCap: 600, maxQtyMultiple: 2.5 });
  });

  it("maps a PO with nested lines, guard reasons and payout fields", () => {
    const po = toPO({
      id: "po1",
      supplier_id: "s1",
      status: "paying",
      total: "23.00",
      currency: "USD",
      rationale: "Restock.",
      guard_decision: "approve",
      guard_reasons: [{ code: "TOTAL_OVER_AUTO_CAP", severity: "escalate", message: "..." }],
      created_by: "agent",
      payout_batch_id: "BATCH-1",
      payout_item_status: "PENDING",
      created_at: "2026-11-10T09:00:00.000Z",
      updated_at: "2026-11-10T09:00:00.000Z",
      po_lines: [{ id: "l1", po_id: "po1", item_id: "i1", qty: "20", unit_price: "1.150" }],
    });

    expect(po).toMatchObject({
      status: "paying",
      total: 23,
      guardDecision: "approve",
      payoutBatchId: "BATCH-1",
      lines: [{ id: "l1", poId: "po1", itemId: "i1", qty: 20, unitPrice: 1.15 }],
    });
    expect(po.guardReasons[0].code).toBe("TOTAL_OVER_AUTO_CAP");
  });

  it("falls back to an explicit line list when the nested select is missing", () => {
    const po = toPO(
      { id: "po1", supplier_id: "s1", status: "drafted", total: 3.45 },
      [{ id: "l1", po_id: "po1", item_id: "i1", qty: 3, unit_price: 1.15 }],
    );

    expect(po.lines).toEqual([{ id: "l1", poId: "po1", itemId: "i1", qty: 3, unitPrice: 1.15 }]);
    expect(po.guardReasons).toEqual([]);
    expect(po.rationale).toBeNull();
  });

  it("maps an event and treats a null po_id as null", () => {
    expect(
      toEvent({
        id: "7",
        ts: "2026-11-10T09:00:00.000Z",
        actor: "guard",
        type: "guard_decision",
        po_id: null,
        detail: { decision: "approve" },
      }),
    ).toMatchObject({ id: 7, actor: "guard", poId: null, detail: { decision: "approve" } });
  });

  it("returns an empty array for a non-array payload", () => {
    expect(rows(null)).toEqual([]);
    expect(rows({ data: [] })).toEqual([]);
    expect(rows([{ id: 1 }])).toEqual([{ id: 1 }]);
  });
});
