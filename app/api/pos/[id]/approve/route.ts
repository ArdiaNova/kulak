import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { getExecutor } from "@/lib/runtime";

/** Human approval. The guard runs again; a deny cannot be overridden. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getExecutor().approvePO(id));
  } catch (error) {
    return errorResponse(error);
  }
}
