import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { getExecutor } from "@/lib/runtime";

/** Human rejection of a pending order. No money moves. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getExecutor().rejectPO(id));
  } catch (error) {
    return errorResponse(error);
  }
}
