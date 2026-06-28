import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ApiKeyRow } from "@/app/dashboard/settings/api-keys-section";

type ServerSupabase = SupabaseClient<Database>;

type ApiKeyRowMinimal = Pick<
  ApiKeyRow,
  "id" | "name" | "key_prefix"
> & {
  created_at: string | null;
  revoked_at: string | null;
};

function normalizeApiKeyRow(
  row: ApiKeyRowMinimal & { last_used_at?: string | null },
): ApiKeyRow {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at ?? "",
    last_used_at: row.last_used_at ?? null,
    revoked_at: row.revoked_at ?? null,
  };
}

/** Fetch user API keys — falls back without last_used_at if column missing on live DB. */
export async function fetchUserApiKeys(
  supabase: ServerSupabase,
  userId: string,
): Promise<ApiKeyRow[]> {
  try {
    const { data: full, error: fullErr } = await supabase
      .from("user_api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!fullErr) {
      return (full ?? []).map((row) => normalizeApiKeyRow(row));
    }

    console.warn(
      "[supabase:queries] user_api_keys full select:",
      fullErr.message,
      "— retrying without last_used_at",
    );

    const { data: minimal, error: minErr } = await supabase
      .from("user_api_keys")
      .select("id, name, key_prefix, created_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (minErr) {
      console.error("[supabase:queries] user_api_keys minimal:", minErr.message);
      return [];
    }

    return (minimal ?? []).map((row) =>
      normalizeApiKeyRow({ ...row, last_used_at: null }),
    );
  } catch (err) {
    console.error("[supabase:queries] fetchUserApiKeys:", err);
    return [];
  }
}
