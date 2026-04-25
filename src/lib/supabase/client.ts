"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Browser-scoped Supabase client.
 * --------------------------------
 * Returns a fresh client per call. The underlying @supabase/ssr helper
 * dedupes internally, so there's no cost to calling this repeatedly from
 * hooks. The anon key in NEXT_PUBLIC_SUPABASE_ANON_KEY is only useful
 * when Row Level Security is enabled on every table — which it must be.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
