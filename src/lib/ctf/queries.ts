import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import type { CtfChallenge, CtfUserSolve } from "@/lib/ctf/types";

const PUBLIC_COLS =
  "id, slug, title, category, difficulty, points, description_md, prompt, hint, is_published, solves, created_at";

export async function fetchPublishedChallenges(): Promise<CtfChallenge[]> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ctf_challenges")
    .select(PUBLIC_COLS)
    .eq("is_published", true)
    .order("points", { ascending: true });

  if (error) {
    console.error("[ctf] list:", error.message);
    return [];
  }
  return (data ?? []) as CtfChallenge[];
}

export async function fetchChallengeBySlug(
  slug: string,
): Promise<CtfChallenge | null> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ctf_challenges")
    .select(PUBLIC_COLS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as CtfChallenge;
}

export async function fetchUserSolves(): Promise<Map<string, CtfUserSolve>> {
  const user = await getSessionUser();
  if (!user) return new Map();

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ctf_submissions")
    .select("challenge_id, is_correct, awarded_points, created_at")
    .eq("user_id", user.id)
    .eq("is_correct", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ctf] solves:", error.message);
    return new Map();
  }

  const map = new Map<string, CtfUserSolve>();
  for (const row of data ?? []) {
    if (!map.has(row.challenge_id)) map.set(row.challenge_id, row);
  }
  return map;
}
