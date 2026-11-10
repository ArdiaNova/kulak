import { NextResponse } from "next/server";

import { runAgent } from "@/lib/agent";
import { createOpenAIModel } from "@/lib/agent.model";
import { errorResponse } from "@/lib/api";
import { getExecutor, getRepo } from "@/lib/runtime";

/**
 * Largest duration allowed on a Vercel Hobby plan with Fluid compute:
 * 300 s (verified on vercel.com/docs/functions/configuring-functions/duration,
 * page updated 2026-08-24; Hobby default and maximum are both 300 s).
 */
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runAgent({
      repo: getRepo(),
      executor: getExecutor(),
      model: createOpenAIModel(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
