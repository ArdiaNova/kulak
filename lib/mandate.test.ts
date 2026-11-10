import { describe, expect, it } from "vitest";

import { DEFAULT_MANDATE, mandateColumns } from "@/lib/mandate";

describe("mandateColumns", () => {
  it("maps every camelCase field to its snake_case column", () => {
    expect(
      mandateColumns({
        mode: "auto",
        weeklyBudget: 500,
        autoApproveCap: 250,
        hardBlockCap: 700,
        maxQtyMultiple: 3,
        maxPriceSpikePct: 15,
      }),
    ).toEqual({
      mode: "auto",
      weekly_budget: 500,
      auto_approve_cap: 250,
      hard_block_cap: 700,
      max_qty_multiple: 3,
      max_price_spike_pct: 15,
    });
  });

  it("leaves fields that were not sent untouched", () => {
    expect(mandateColumns({ mode: "manual" })).toEqual({ mode: "manual" });
    expect(mandateColumns({})).toEqual({});
  });

  it("maps the reset defaults to columns that exist in supabase/reset.sql", () => {
    expect(mandateColumns(DEFAULT_MANDATE)).toEqual({
      mode: "manual",
      weekly_budget: 600,
      auto_approve_cap: 200,
      hard_block_cap: 600,
      max_qty_multiple: 2.5,
      max_price_spike_pct: 20,
    });
  });

  it("never emits a camelCase key", () => {
    const keys = Object.keys(mandateColumns(DEFAULT_MANDATE));
    expect(keys.filter((key) => /[A-Z]/.test(key))).toEqual([]);
  });
});
