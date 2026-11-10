import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";

import { EnvError } from "@/lib/env";
import { ExecutorError } from "@/lib/executor";
import { PayPalError } from "@/lib/paypal";
import { POError } from "@/lib/po";

/**
 * One error shape for every route: { error: { code, message, issues? } }.
 * Unknown errors never leak their message to the client.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_STATUS: Record<string, number> = {
  PO_NOT_FOUND: 404,
  INVALID_STATE: 409,
  NO_PAYOUT: 409,
  NO_ROGUE_SUPPLIER: 409,
};

function statusFor(code: string, fallback: number): number {
  return DEFAULT_STATUS[code] ?? fallback;
}

function codeOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.code;
  if (error instanceof ExecutorError) return error.code;
  if (error instanceof POError) return error.code;
  return null;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "The request body does not match the expected shape.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof EnvError) {
    // Names only, never values.
    return NextResponse.json(
      { error: { code: "ENV_MISSING", message: error.message, fields: error.fields } },
      { status: 500 },
    );
  }

  // Match by name, not instanceof: the agent adapter may live in another bundle.
  if (error instanceof Error && error.name === "AgentError") {
    const code = (error as { code?: unknown }).code;
    return NextResponse.json(
      { error: { code: typeof code === "string" ? code : "AGENT_ERROR", message: error.message } },
      { status: 502 },
    );
  }

  if (error instanceof PayPalError) {
    return NextResponse.json(
      {
        error: {
          code: error.name || "PAYPAL_ERROR",
          message: "PayPal rejected the request.",
        },
      },
      { status: 502 },
    );
  }

  const code = codeOf(error);
  if (code) {
    return NextResponse.json(
      { error: { code, message: (error as Error).message } },
      { status: statusFor(code, 422) },
    );
  }

  console.error("[api] unexpected error:", error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Unexpected server error." } },
    { status: 500 },
  );
}

/** Parse a JSON body with Zod. Throws ApiError or ZodError, both handled above. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}
