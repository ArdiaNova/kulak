import type { MandatePatch, NewPO, PayoutUpdate, Repo } from "@/lib/repo";
import type {
  Event,
  Item,
  Mandate,
  POStatus,
  PurchaseOrder,
  Reason,
  Supplier,
  SupplierQuote,
} from "@/lib/types";

/** In-memory Repo for tests. No network, no Supabase. */

export type FakeState = {
  mandate: Mandate;
  items: Item[];
  suppliers: Supplier[];
  quotes: SupplierQuote[];
  pos: PurchaseOrder[];
  events: Event[];
};

export const BEANS = "item-beans";
export const MILK = "item-milk";
export const GOOD = "sup-good";
export const BAD = "sup-bad";

export function defaultSeed(): FakeState {
  return {
    mandate: {
      id: 1,
      mode: "manual",
      currency: "USD",
      weeklyBudget: 600,
      autoApproveCap: 200,
      hardBlockCap: 600,
      maxQtyMultiple: 2.5,
      maxPriceSpikePct: 20,
    },
    items: [
      {
        id: BEANS,
        sku: "BEANS-ESP",
        name: "Espresso beans",
        unit: "kg",
        stock: 6,
        reorderPoint: 8,
        avgDailyUse: 1.8,
      },
      {
        id: MILK,
        sku: "MILK-WHL",
        name: "Whole milk",
        unit: "L",
        stock: 14,
        reorderPoint: 30,
        avgDailyUse: 9,
      },
    ],
    suppliers: [
      { id: GOOD, name: "Bean & Co", approved: true },
      { id: BAD, name: "CheapBeans", approved: false },
    ],
    quotes: [
      { id: "q1", supplierId: GOOD, itemId: BEANS, unitPrice: 14.5, lastPaidPrice: 12, moq: 5, leadDays: 3 },
      { id: "q2", supplierId: GOOD, itemId: MILK, unitPrice: 1.15, lastPaidPrice: 1.12, moq: 20, leadDays: 1 },
      { id: "q3", supplierId: BAD, itemId: BEANS, unitPrice: 11.2, lastPaidPrice: null, moq: 5, leadDays: 2 },
    ],
    pos: [],
    events: [],
  };
}

const copy = <T>(value: T): T => structuredClone(value);
const toArray = (from: POStatus | POStatus[]): POStatus[] =>
  Array.isArray(from) ? from : [from];

export function createFakeRepo(
  options: { seed?: Partial<FakeState>; clock?: () => Date } = {},
): { state: FakeState; repo: Repo } {
  const clock = options.clock ?? (() => new Date());
  const seed: FakeState = { ...defaultSeed(), ...options.seed };
  const state: FakeState = copy(seed);

  let poSeq = 0;
  let eventSeq = 0;

  const repo: Repo = {
    async getMandate() {
      return copy(state.mandate);
    },

    async updateMandate(patch: MandatePatch, now: Date) {
      state.mandate = { ...state.mandate, ...patch, updatedAt: now };
      return copy(state.mandate);
    },

    async listItems() {
      return copy(state.items);
    },

    async listSuppliers() {
      return copy(state.suppliers);
    },

    async listQuotes() {
      return copy(state.quotes);
    },

    async listPOs() {
      return copy(state.pos);
    },

    async getPO(id) {
      const po = state.pos.find((candidate) => candidate.id === id);
      return po ? copy(po) : null;
    },

    async insertPO(input: NewPO) {
      const now = clock();
      const id = `po-${++poSeq}`;
      const po: PurchaseOrder = {
        id,
        supplierId: input.supplierId,
        status: "drafted",
        total: input.total,
        currency: input.currency,
        rationale: input.rationale,
        guardDecision: null,
        guardReasons: [],
        createdBy: input.createdBy,
        payoutBatchId: null,
        payoutItemStatus: null,
        createdAt: now,
        updatedAt: now,
        lines: input.lines.map((line, index) => ({
          id: `line-${id}-${index}`,
          poId: id,
          itemId: line.itemId,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
      };
      state.pos.unshift(po);
      return copy(po);
    },

    async updatePOStatus(id, from, to) {
      const po = state.pos.find((candidate) => candidate.id === id);
      if (!po || !toArray(from).includes(po.status)) return false;
      po.status = to;
      po.updatedAt = clock();
      return true;
    },

    async setGuardResult(id, decision, reasons: Reason[]) {
      const po = state.pos.find((candidate) => candidate.id === id);
      if (!po) return;
      po.guardDecision = decision;
      po.guardReasons = copy(reasons);
    },

    async setPayout(id, payout: PayoutUpdate) {
      const po = state.pos.find((candidate) => candidate.id === id);
      if (!po) return;
      po.payoutBatchId = payout.batchId;
      po.payoutItemStatus = payout.itemStatus ?? null;
    },

    async addStock(itemId, delta) {
      const item = state.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      item.stock = Math.max(0, item.stock + delta);
    },

    async insertEvent(event: Event) {
      state.events.push({ ...copy(event), id: ++eventSeq, ts: clock() });
    },

    async listEvents(limit) {
      return copy(
        [...state.events]
          .sort((a, b) => (b.ts?.getTime() ?? 0) - (a.ts?.getTime() ?? 0))
          .slice(0, limit),
      );
    },

    async resetDemo() {
      const fresh = copy(seed);
      state.mandate = fresh.mandate;
      state.items = fresh.items;
      state.suppliers = fresh.suppliers;
      state.quotes = fresh.quotes;
      state.pos = fresh.pos;
      state.events = fresh.events;
    },
  };

  return { state, repo };
}
