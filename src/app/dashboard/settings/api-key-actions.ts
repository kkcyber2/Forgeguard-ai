"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Generate a cryptographically random key: fg_<64 hex chars> */
function generateRawKey(): string {
  return "fg_" + randomBytes(32).toString("hex");
}

/* ── Create API key ──────────────────────────────────────────────────────── */

export interface CreateKeyState {
  ok: boolean;
  error?: string;
  newKey?: string;
  fieldErrors?: Record<string, string>;
}

const NameSchema = z
  .string()
  .min(1, "Name is required")
  .max(80, "Too long");

export async function createApiKey(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const nameResult = NameSchema.safeParse(formData.get("name"));
  if (!nameResult.success) {
    return {
      ok: false,
      fieldErrors: { name: nameResult.error.issues[0].message },
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const rawKey = generateRawKey();
  const keyHash = sha256hex(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "fg_" + 8 chars

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (supabase as any)
    .from("user_api_keys")
    .insert({
      user_id: user.id,
      name: nameResult.data,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    });

  if (insErr) {
    console.error("[api-key-actions] insert:", insErr.message);
    return { ok: false, error: "Could not create API key. Try again." };
  }

  revalidatePath("/dashboard/settings");

  // Return the raw key — this is the ONLY time it is returned.
  return { ok: true, newKey: rawKey };
}

/* ── Revoke API key ──────────────────────────────────────────────────────── */

const UuidSchema = z.string().uuid();

export async function revokeApiKey(formData: FormData): Promise<void> {
  const parsed = UuidSchema.safeParse(formData.get("key_id"));
  if (!parsed.success) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS ensures only the owner can update their own keys.
  await supabase
    .from("user_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/settings");
}
