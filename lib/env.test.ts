import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  EnvError,
  llmSchema,
  paypalSchema,
  readEnv,
  supabaseSchema,
} from "@/lib/env";

const schema = z.object({
  API_URL: z.url(),
  API_KEY: z.string().min(20),
  OPTIONAL_FLAG: z.enum(["true", "false"]).default("true"),
});

describe("readEnv", () => {
  it("parses a valid group and applies defaults", () => {
    const env = readEnv(schema, {
      API_URL: "https://example.supabase.co",
      API_KEY: "x".repeat(20),
    });

    expect(env.API_URL).toBe("https://example.supabase.co");
    expect(env.OPTIONAL_FLAG).toBe("true");
  });

  it("throws EnvError naming the missing variables, without leaking values", () => {
    const secret = "super-secret-value";

    let caught: unknown;
    try {
      readEnv(schema, { API_KEY: secret });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvError);
    const error = caught as EnvError;
    expect(error.fields.sort()).toEqual(["API_KEY", "API_URL"]);
    expect(error.message).toContain("API_URL");
    expect(error.message).not.toContain(secret);
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      readEnv(schema, {
        API_URL: "not-a-url",
        API_KEY: "x".repeat(20),
      }),
    ).toThrow(EnvError);
  });
});

describe(".env.example", () => {
  it("documents exactly the variables lib/env.ts validates", () => {
    const file = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    const documented = file
      .split("\n")
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter((name): name is string => Boolean(name))
      .sort();

    const expected = [
      ...Object.keys(supabaseSchema.shape),
      ...Object.keys(paypalSchema.shape),
      ...Object.keys(llmSchema.shape),
    ].sort();

    expect(documented).toEqual(expected);
  });
});
