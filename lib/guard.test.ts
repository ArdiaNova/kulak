import { describe, expect, it } from "vitest";

import { cases, HOUR, KNOWN_CODES, line, makeInput, NOW, open, quotes } from "@/lib/guard.cases";
import { evaluatePO } from "@/lib/guard";
import type { Reason } from "@/lib/types";

describe("evaluatePO", () => {
  it.each(cases)("$name → $decision", ({ input, decision, codes }) => {
    const result = evaluatePO(input);

    expect(result.decision).toBe(decision);
    expect(result.reasons.map((r) => r.code).sort()).toEqual([...codes].sort());
  });

  it("covers every rule code at least once", () => {
    const seen = new Set(cases.flatMap((c) => c.codes));
    expect([...seen].sort()).toEqual([...KNOWN_CODES].sort());
  });

  it("gives every reason a known code, a valid severity and a readable message", () => {
    for (const { input } of cases) {
      for (const reason of evaluatePO(input).reasons) {
        expect(KNOWN_CODES).toContain(reason.code);
        expect(["deny", "escalate"]).toContain(reason.severity);
        expect(reason.message.length).toBeGreaterThan(10);
      }
    }
  });

  it("includes the numbers in the auto-cap message", () => {
    const result = evaluatePO(
      makeInput({
        po: { total: 217.5, lines: [line(10, 21.75)] },
        quotes: quotes({ unitPrice: 21.75, lastPaidPrice: 21.75 }),
      }),
    );

    const reason = result.reasons.find((r) => r.code === "TOTAL_OVER_AUTO_CAP") as Reason;
    expect(reason.message).toContain("$217.50");
    expect(reason.message).toContain("$200.00");
  });

  it("depends only on the injected now", () => {
    const recent = makeInput({ openPOs: open("paid", 23) });
    const later = { ...recent, now: new Date(NOW.getTime() + 2 * HOUR) };

    expect(evaluatePO(recent).decision).toBe("deny");
    expect(evaluatePO(later).decision).toBe("approve");
    expect(evaluatePO(recent)).toEqual(evaluatePO(recent));
  });

  it("does not mutate its input", () => {
    const input = makeInput({ openPOs: open("paid", 1) });
    const snapshot = () =>
      JSON.stringify({
        po: input.po,
        weekSpent: input.weekSpent,
        openPOs: input.openPOs,
        now: input.now,
      });

    const before = snapshot();
    evaluatePO(input);
    expect(snapshot()).toBe(before);
  });
});
