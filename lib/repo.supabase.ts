import "server-only";

import { getDb } from "@/lib/db";
import { DEFAULT_MANDATE, mandateColumns } from "@/lib/mandate";
import type { MandatePatch, NewPO, PayoutUpdate, Repo } from "@/lib/repo";
import {
  PO_SELECT,
  num,
  rows,
  str,
  toEvent,
  toItem,
  toMandate,
  toPO,
  toQuote,
  toSupplier,
  type Row,
} from "@/lib/rows";
import type { Event, GuardDecision, Reason } from "@/lib/types";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export const SEED_STOCK: Record<string, number> = {
  "BEANS-ESP": 6,
  "MILK-WHL": 14,
  "MILK-OAT": 20,
  "CUP-12": 180,
  "LID-12": 220,
  "SYR-VAN": 3,
};

export function createSupabaseRepo(): Repo {
  const db = () => getDb();

  async function one<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
    const { data, error } = await promise;
    if (error) throw new Error(`${what} failed: ${error.message}`);
    return data as T;
  }

  return {
    async getMandate() {
      const data = await one<Row>(
        db().from("mandate").select("*").eq("id", 1).single(),
        "read mandate",
      );
      return toMandate(data);
    },

    async updateMandate(patch: MandatePatch, now: Date) {
      const update: Row = { ...mandateColumns(patch), updated_at: now.toISOString() };
      const data = await one<Row>(
        db().from("mandate").update(update).eq("id", 1).select("*").single(),
        "update mandate",
      );
      return toMandate(data);
    },

    async listItems() {
      const data = await one<Row[]>(
        db().from("items").select("*").order("sku", { ascending: true }),
        "read items",
      );
      return rows(data).map(toItem);
    },

    async listSuppliers() {
      const data = await one<Row[]>(
        db().from("suppliers").select("*").order("name", { ascending: true }),
        "read suppliers",
      );
      return rows(data).map(toSupplier);
    },

    async listQuotes() {
      const data = await one<Row[]>(
        db().from("supplier_quotes").select("*"),
        "read quotes",
      );
      return rows(data).map(toQuote);
    },

    async listPOs() {
      const data = await one<Row[]>(
        db().from("purchase_orders").select(PO_SELECT).order("created_at", { ascending: false }),
        "read purchase orders",
      );
      return rows(data).map((row) => toPO(row));
    },

    async getPO(id) {
      const { data, error } = await db()
        .from("purchase_orders")
        .select(PO_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`read purchase order failed: ${error.message}`);
      return data ? toPO(data as Row) : null;
    },

    async insertPO(input: NewPO) {
      const header = await one<Row>(
        db()
          .from("purchase_orders")
          .insert({
            supplier_id: input.supplierId,
            status: "drafted",
            total: input.total,
            currency: input.currency,
            rationale: input.rationale,
            created_by: input.createdBy,
          })
          .select("*")
          .single(),
        "create purchase order",
      );

      const poId = str(header.id);
      const lines = input.lines.map((line) => ({
        po_id: poId,
        item_id: line.itemId,
        qty: line.qty,
        unit_price: line.unitPrice,
      }));

      const insertedLines = await one<Row[]>(
        db().from("po_lines").insert(lines).select("*"),
        "create purchase order lines",
      );

      return toPO(header, rows(insertedLines));
    },

    async updatePOStatus(id, from, to) {
      const froms = Array.isArray(from) ? from : [from];
      const { data, error } = await db()
        .from("purchase_orders")
        .update({ status: to, updated_at: new Date().toISOString() })
        .eq("id", id)
        .in("status", froms)
        .select("id");
      if (error) throw new Error(`update purchase order failed: ${error.message}`);
      return rows(data).length > 0;
    },

    async setGuardResult(id, decision: GuardDecision, reasons: Reason[]) {
      const { error } = await db()
        .from("purchase_orders")
        .update({ guard_decision: decision, guard_reasons: reasons })
        .eq("id", id);
      if (error) throw new Error(`store guard result failed: ${error.message}`);
    },

    async setPayout(id, payout: PayoutUpdate) {
      const { error } = await db()
        .from("purchase_orders")
        .update({
          payout_batch_id: payout.batchId,
          payout_item_status: payout.itemStatus ?? null,
        })
        .eq("id", id);
      if (error) throw new Error(`store payout failed: ${error.message}`);
    },

    async addStock(itemId, delta) {
      const { data, error } = await db()
        .from("items")
        .select("stock")
        .eq("id", itemId)
        .single();
      if (error) throw new Error(`read stock failed: ${error.message}`);

      const next = Math.max(0, num((data as Row).stock) + delta);
      const update = await db().from("items").update({ stock: next }).eq("id", itemId);
      if (update.error) throw new Error(`update stock failed: ${update.error.message}`);
    },

    async insertEvent(event: Event) {
      const { error } = await db().from("events").insert({
        actor: event.actor,
        type: event.type,
        po_id: event.poId ?? null,
        detail: event.detail ?? {},
      });
      if (error) throw new Error(`write event failed: ${error.message}`);
    },

    async listEvents(limit) {
      const data = await one<Row[]>(
        db()
          .from("events")
          .select("*")
          .order("ts", { ascending: false })
          .limit(limit),
        "read events",
      );
      return rows(data).map(toEvent);
    },

    async resetDemo(now: Date) {
      const statements = [
        db().from("po_lines").delete().neq("id", EMPTY_UUID),
        db().from("purchase_orders").delete().neq("id", EMPTY_UUID),
        db().from("events").delete().gte("id", 0),
      ];
      for (const statement of statements) {
        const { error } = await statement;
        if (error) throw new Error(`reset demo failed: ${error.message}`);
      }

      await Promise.all(
        Object.entries(SEED_STOCK).map(([sku, stock]) =>
          db().from("items").update({ stock }).eq("sku", sku),
        ),
      );

      const { error } = await db()
        .from("mandate")
        .update({ ...mandateColumns(DEFAULT_MANDATE), updated_at: now.toISOString() })
        .eq("id", 1);
      if (error) throw new Error(`reset mandate failed: ${error.message}`);
    },
  };
}
