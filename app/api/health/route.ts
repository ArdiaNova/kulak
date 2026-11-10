import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

/**
 * Liveness probe. `db` is true when a trivial query against `items` succeeds.
 * Never returns error details or secrets.
 */
export async function GET() {
  let db = false;
  try {
    const { error } = await getDb()
      .from("items")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    db = !error;
  } catch {
    db = false;
  }

  return NextResponse.json({ ok: true, db, time: new Date().toISOString() });
}
