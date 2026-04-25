import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * ----------------------------------------------------------
 *
 * Guard rails:
 *   1. Only constructed inside server boundaries (`server-only`).
 *   2. Caller MUST have already verified the request is admin-authorised.
 *   3. Prefer `createServerSupabase()` from ./server for anything that
 *      can be satisfied by RLS — service-role is the last resort.
 */
export function createAdminSupabase() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[forgeguard:supabase] createAdminSupabase() requires SUPABASE_SERVICE_ROLE_KEY. " +
        "Set it in .env.local and restart the server.",
    );
  }
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { "x-forgeguard-role": "service" },
      },
    },
  );
}
