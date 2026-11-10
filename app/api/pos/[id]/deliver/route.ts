import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { getExecutor } from "@/lib/runtime";

/** Mark a paid order delivered: adds each line's qty to stock, exactly once. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getExecutor().markDelivered(id));
  } catch (error) {
    return errorResponse(error);
  }
}
