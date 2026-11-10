import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorResponse, parseBody } from "@/lib/api";
import type { MandatePatch } from "@/lib/repo";
import { getRepo } from "@/lib/runtime";

/**
 * Edit the spending mandate. This is the only way the browser can change the
 * caps; the guard stays the authority and the LLM never sees this route.
 */
const patchSchema = z
  .strictObject({
    mode: z.enum(["manual", "auto"]).optional(),
    weeklyBudget: z.number().positive().max(1_000_000).optional(),
    autoApproveCap: z.number().positive().max(1_000_000).optional(),
    hardBlockCap: z.number().positive().max(1_000_000).optional(),
    maxQtyMultiple: z.number().positive().max(100).optional(),
    maxPriceSpikePct: z.number().min(0).max(1000).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Send at least one mandate field.",
  });

export async function PATCH(request: Request) {
  try {
    const patch = await parseBody(request, patchSchema);
    const repo = getRepo();

    const current = await repo.getMandate();
    const next = { ...current, ...patch };
    if (next.autoApproveCap > next.hardBlockCap) {
      throw new ApiError(
        "MANDATE_INCONSISTENT",
        "The auto-approve cap cannot be above the hard block cap.",
        422,
      );
    }

    const mandate = await repo.updateMandate(patch as MandatePatch, new Date());
    await repo.insertEvent({
      actor: "human",
      type: "mandate_updated",
      detail: { ...patch },
    });

    return NextResponse.json({ mandate });
  } catch (error) {
    return errorResponse(error);
  }
}
