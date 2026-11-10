import { z } from "zod";

import { paypalEnv } from "./env";

/**
 * Low level PayPal plumbing: typed errors, timeouts, token cache.
 * Endpoint facts verified against developer.paypal.com (see lib/paypal.ts).
 */

const TIMEOUT_MS = 15_000;
const TOKEN_MARGIN_MS = 60_000;

export class PayPalError extends Error {
  readonly status: number;
  readonly debugId: string | null;

  constructor(status: number, name: string, message: string, debugId: string | null = null) {
    super(message);
    this.status = status;
    this.name = name;
    this.debugId = debugId;
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
});

const errorSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  debug_id: z.string().nullish(),
});

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Test helper: forget the cached token. */
export function resetPayPalCache(): void {
  tokenCache = null;
}

export function fail(status: number, json: unknown): never {
  const parsed = errorSchema.safeParse(json);
  const name = parsed.success && parsed.data.name ? parsed.data.name : `HTTP_${status}`;
  const message =
    parsed.success && parsed.data.message
      ? parsed.data.message
      : `PayPal returned HTTP ${status}.`;
  const debugId = parsed.success ? (parsed.data.debug_id ?? null) : null;
  throw new PayPalError(status, name, message, debugId);
}

export function parseResponse<T extends z.ZodType>(
  schema: T,
  json: unknown,
  what: string,
): z.infer<T> {
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new PayPalError(0, "BAD_RESPONSE", `Unexpected PayPal response (${what}).`);
  }
  return result.data;
}

export async function http(
  path: string,
  init: RequestInit,
): Promise<{ res: Response; json: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${paypalEnv().PAYPAL_API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new PayPalError(
      0,
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      timedOut ? `PayPal did not answer within ${TIMEOUT_MS / 1000} s.` : "Could not reach PayPal.",
    );
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, json };
}

export async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = paypalEnv();
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const { res, json } = await http("/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) fail(res.status, json);

  const token = parseResponse(tokenSchema, json, "token");
  tokenCache = {
    token: token.access_token,
    expiresAt: Date.now() + Math.max(0, token.expires_in * 1000 - TOKEN_MARGIN_MS),
  };
  return tokenCache.token;
}
