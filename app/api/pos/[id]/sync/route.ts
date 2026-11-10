import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { getExecutor } from "@/lib/runtime";

/** Poll PayPal for the payout batch and apply SUCCESS / failure / pending. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getExecutor().syncPayout(id));
  } catch (error) {
    return errorResponse(error);
  }
}
