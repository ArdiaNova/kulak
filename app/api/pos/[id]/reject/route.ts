import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorResponse } from "@/lib/api";
import { getExecutor } from "@/lib/runtime";

/** Human rejection of a pending order. No money moves. */

const rejectSchema = z.object({
  reason: z.string().trim().max(280).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new ApiError("INVALID_REASON", "A rejection note can be at most 280 characters.", 400);
    }
    return NextResponse.json(await getExecutor().rejectPO(id, parsed.data.reason));
  } catch (error) {
    return errorResponse(error);
  }
}
