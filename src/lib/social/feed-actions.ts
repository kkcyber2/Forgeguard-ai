"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export type FeedPost = {
  id: string;
  user_id: string;
  team_id: string | null;
  content: string;
  media_path: string | null;
  visibility: string;
  like_count: number;
  created_at: string;
  author_name: string;
  rank_label: string;
  liked_by_me: boolean;
};

export async function listFeed(limit = 30, teamId?: string | null): Promise<FeedPost[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("social_posts")
    .select("id, user_id, team_id, content, media_path, visibility, like_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (teamId) {
    query = query.eq("team_id", teamId).eq("visibility", "team");
  } else {
    query = query.eq("visibility", "public").is("team_id", null);
  }

  const { data: posts, error } = await query;
  if (error || !posts?.length) return [];

  const userIds = Array.from(
    new Set(posts.map((p: { user_id: string }) => p.user_id)),
  ) as string[];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, hacker_rank")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.full_name ?? p.email?.split("@")[0] ?? "operator",
        rank: p.hacker_rank ?? "RECRUIT",
      },
    ]),
  );

  const postIds = posts.map((p: { id: string }) => p.id);
  const { data: likes } = await (supabase as any)
    .from("social_post_likes")
    .select("post_id")
    .eq("user_id", user.id)
    .in("post_id", postIds);

  const likedSet = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));

  return posts.map((p: FeedPost) => {
    const prof = profileMap.get(p.user_id);
    return {
      ...p,
      author_name: prof?.name ?? "operator",
      rank_label: prof?.rank ?? "RECRUIT",
      liked_by_me: likedSet.has(p.id),
    };
  });
}

export async function createPost(input: {
  content: string;
  teamId?: string | null;
  visibility?: "public" | "team";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const content = input.content.trim();
  if (!content || content.length > 2000) {
    return { ok: false, error: "Invalid content length" };
  }

  const supabase = await createServerSupabase();
  const visibility = input.visibility ?? (input.teamId ? "team" : "public");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("social_posts")
    .insert({
      user_id: user.id,
      team_id: input.teamId ?? null,
      content,
      visibility,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/intel");
  return { ok: true, id: data.id as string };
}

export async function likePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("social_post_likes").insert({
    post_id: postId,
    user_id: user.id,
  });

  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/intel");
  return { ok: true };
}
