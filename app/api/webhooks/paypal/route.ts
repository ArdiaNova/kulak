import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api";
import { paypalEnv } from "@/lib/env";
import { getPayoutItem, verifyWebhook } from "@/lib/paypal";
import { getExecutor, getRepo } from "@/lib/runtime";
import { handleWebhook } from "@/lib/webhook";

/**
 * PayPal webhook. PayPal retries on any non-2xx, so every branch that has
 * already accepted the event answers 200 quickly; only a bad signature (400) or
 * a failed PayPal lookup (502) asks for a retry.
 */

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const skipVerify =
      process.env.NODE_ENV !== "production" && paypalEnv().PAYPAL_WEBHOOK_VERIFY === "false";

    const outcome = await handleWebhook(raw, request.headers, {
      repo: getRepo(),
      executor: getExecutor(),
      verify: verifyWebhook,
      getItem: getPayoutItem,
      skipVerify,
    });

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    return errorResponse(error);
  }
}
