import { describe, expect, it } from "vitest";

import { createFakeRepo, BEANS, BAD, GOOD, MILK } from "@/lib/fake-repo";
import { createPO } from "@/lib/po";

const clock = () => new Date("2026-11-10T09:00:00.000Z");

function setup() {
  const { state, repo } = createFakeRepo({ clock });
  return { state, repo };
}

const base = {
  supplierId: GOOD,
  rationale: "Restock for the coming week.",
  createdBy: "agent",
};

describe("createPO", () => {
  it("prices lines from supplier_quotes and rounds the total to 2 decimals", async () => {
    const { repo } = setup();

    const po = await createPO(repo, { ...base, lines: [{ itemId: MILK, qty: 3 }] });

    expect(po.lines).toEqual([{ id: expect.any(String), poId: po.id, itemId: MILK, qty: 3, unitPrice: 1.15 }]);
    expect(po.total).toBe(3.45); // 3 * 1.15 = 3.4499999999999997 in floating point
    expect(po.status).toBe("drafted");
    expect(po.currency).toBe("USD");
  });

  it("computes the total from quotes for several lines", async () => {
    const { repo } = setup();

    const po = await createPO(repo, {
      ...base,
      lines: [
        { itemId: MILK, qty: 20 },
        { itemId: BEANS, qty: 10 },
      ],
    });

    expect(po.total).toBe(168); // 20 * 1.15 + 10 * 14.5
  });

  it("writes a po_created event", async () => {
    const { repo } = setup();

    const po = await createPO(repo, { ...base, lines: [{ itemId: MILK, qty: 20 }] });
    const events = await repo.listEvents(10);

    expect(events.find((event) => event.type === "po_created")).toMatchObject({
      actor: "agent",
      poId: po.id,
      detail: { total: 23 },
    });
  });

  it("records an owner-placed order as a human action", async () => {
    const { repo } = setup();

    const po = await createPO(repo, {
      ...base,
      createdBy: "human",
      lines: [{ itemId: MILK, qty: 20 }],
    });
    const events = await repo.listEvents(10);

    expect(po.createdBy).toBe("human");
    expect(events.find((event) => event.type === "po_created")).toMatchObject({
      actor: "human",
      poId: po.id,
    });
  });

  it("rejects an item the supplier does not quote", async () => {
    const { repo } = setup();

    await expect(
      createPO(repo, { ...base, lines: [{ itemId: "item-unknown", qty: 5 }] }),
    ).rejects.toMatchObject({ code: "ITEM_NOT_QUOTED" });
  });

  it("rejects a zero or negative quantity", async () => {
    const { repo } = setup();

    await expect(
      createPO(repo, { ...base, lines: [{ itemId: MILK, qty: 0 }] }),
    ).rejects.toMatchObject({ code: "INVALID_QTY" });
  });

  it("rejects an unknown supplier, an empty order and a missing rationale", async () => {
    const { repo } = setup();

    await expect(
      createPO(repo, { ...base, supplierId: "nope", lines: [{ itemId: MILK, qty: 20 }] }),
    ).rejects.toMatchObject({ code: "SUPPLIER_NOT_FOUND" });

    await expect(createPO(repo, { ...base, lines: [] })).rejects.toMatchObject({
      code: "EMPTY_PO",
    });

    await expect(
      createPO(repo, { ...base, rationale: "   ", lines: [{ itemId: MILK, qty: 20 }] }),
    ).rejects.toMatchObject({ code: "MISSING_RATIONALE" });
  });

  it("refuses to build an order for the unapproved supplier at the data layer", async () => {
    // The guard decides on approval, not pricing: a rogue PO can still be drafted.
    const { repo } = setup();

    const po = await createPO(repo, {
      ...base,
      supplierId: BAD,
      lines: [{ itemId: BEANS, qty: 50 }],
    });

    expect(po.supplierId).toBe(BAD);
    expect(po.total).toBe(560); // 50 * 11.2
  });
});
