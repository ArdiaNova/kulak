import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { getRepo } from "@/lib/runtime";

/** Demo helper: same effect as supabase/reset.sql. */
export async function POST() {
  try {
    await getRepo().resetDemo(new Date());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
