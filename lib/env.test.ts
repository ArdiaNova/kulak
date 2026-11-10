import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EnvError, readEnv } from "@/lib/env";

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
