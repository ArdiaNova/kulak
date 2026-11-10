import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { daysLeft, weekSpent } from "@/lib/metrics";
import { getRepo } from "@/lib/runtime";

/**
 * Everything the dashboard needs in one round trip: stock with days left,
 * suppliers and quotes, the mandate, this week's spend, POs with lines, and the
 * last 50 audit events.
 */
export async function GET() {
  try {
    const repo = getRepo();
    const now = new Date();

    const [items, suppliers, quotes, mandate, pos, events] = await Promise.all([
      repo.listItems(),
      repo.listSuppliers(),
      repo.listQuotes(),
      repo.getMandate(),
      repo.listPOs(),
      repo.listEvents(50),
    ]);

    return NextResponse.json({
      now: now.toISOString(),
      items: items.map((item) => ({ ...item, daysLeft: daysLeft(item) })),
      suppliers,
      quotes,
      mandate,
      weekSpent: weekSpent(pos, now),
      pos,
      events,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
