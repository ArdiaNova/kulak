import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseEnv } from "@/lib/env";

/**
 * Server-only Supabase client using the service-role key.
 * Never import this from a client component.
 */
let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = supabaseEnv();
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
