import { z } from "zod";

/**
 * Zod-validated environment. Validation is lazy: nothing is parsed at import
 * time, so `next build` works on a machine without secrets.
 *
 * Errors list the offending variable NAME only. Never echo the value.
 */

export const supabaseSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export const paypalSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_API_BASE: z.url().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
  PAYPAL_WEBHOOK_VERIFY: z.enum(["true", "false"]).default("true"),
  SUPPLIER_PAYOUT_EMAIL: z.email(),
});

export const llmSchema = z.object({
  LLM_BASE_URL: z.url(),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof supabaseSchema>;
export type PayPalEnv = z.infer<typeof paypalSchema>;
export type LlmEnv = z.infer<typeof llmSchema>;

export class EnvError extends Error {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(
      `Missing or invalid environment variables: ${fields.join(", ")}. See .env.example.`,
    );
    this.name = "EnvError";
    this.fields = fields;
  }
}

/** Parse one group of env vars from an explicit source. Pure, so it is testable. */
export function readEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => String(issue.path[0] ?? "env")),
      ),
    ];
    throw new EnvError(fields);
  }
  return result.data;
}

const cache = new Map<string, unknown>();

function memo<T>(key: string, build: () => T): T {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key) as T;
}

export function supabaseEnv(): SupabaseEnv {
  return memo("supabase", () => readEnv(supabaseSchema));
}

export function paypalEnv(): PayPalEnv {
  return memo("paypal", () => readEnv(paypalSchema));
}

export function llmEnv(): LlmEnv {
  return memo("llm", () => readEnv(llmSchema));
}
