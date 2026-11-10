import "server-only";

import { createExecutor, type Executor } from "@/lib/executor";
import { paypalEnv } from "@/lib/env";
import { createPayout, getPayoutBatch } from "@/lib/paypal";
import type { Repo } from "@/lib/repo";
import { createSupabaseRepo } from "@/lib/repo.supabase";

/**
 * Lazily built singletons for route handlers. Nothing is constructed at import
 * time, so `next build` does not need secrets.
 */

let repo: Repo | null = null;
let executor: Executor | null = null;

export function getRepo(): Repo {
  if (!repo) repo = createSupabaseRepo();
  return repo;
}

export function getExecutor(): Executor {
  if (!executor) {
    const { SUPPLIER_PAYOUT_EMAIL } = paypalEnv();
    executor = createExecutor({
      repo: getRepo(),
      paypal: { createPayout, getPayoutBatch },
      receiver: SUPPLIER_PAYOUT_EMAIL,
    });
  }
  return executor;
}
