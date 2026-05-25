import type { PostgrestError } from "@supabase/supabase-js";

/** Defensive PostgREST wrapper — never throws; returns fallback on 400/500. */
export async function safeQuery<T>(
  label: string,
  query: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  fallback: T,
): Promise<{ data: T; error: null }> {
  try {
    const { data, error } = await query();
    if (error) {
      console.error(`[supabase:safe] ${label}:`, error.message, error.code ?? "");
      return { data: fallback, error: null };
    }
    return { data: (data ?? fallback) as T, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[supabase:safe] ${label} throw:`, msg);
    return { data: fallback, error: null };
  }
}

export async function safeQueryRows<T>(
  label: string,
  query: () => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: null }> {
  return safeQuery(label, query, [] as T[]);
}
