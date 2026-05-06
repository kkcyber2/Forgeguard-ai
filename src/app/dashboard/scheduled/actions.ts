"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { sealCredential } from "@/lib/crypto/credentials";

/* ── Create scheduled scan ─────────────────────────────────────────────── */

export interface CreateScheduleState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "target_model" | "target_url" | "api_key" | "frequency", string>
  >;
}

const CreateSchema = z.object({
  name: z.string().min(1, "Required").max(80, "Too long"),
  target_model: z.string().min(2, "Required").max(80, "Too long"),
  target_url: z.string().url("Must be a full URL"),
  api_key: z.string().min(8, "Too short").max(2048, "Too long"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
});

function flattenZod(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Compute the first next_run_at based on frequency */
function firstNextRun(frequency: "daily" | "weekly" | "monthly"): Date {
  const d = new Date();
  if (frequency === "daily")   d.setDate(d.getDate() + 1);
  if (frequency === "weekly")  d.setDate(d.getDate() + 7);
  if (frequency === "monthly") d.setDate(d.getDate() + 30);
  return d;
}

export async function createSchedule(
  _prev: CreateScheduleState,
  formData: FormData,
): Promise<CreateScheduleState> {
  const parsed = CreateSchema.safeParse({
    name:         formData.get("name"),
    target_model: formData.get("target_model"),
    target_url:   formData.get("target_url"),
    api_key:      formData.get("api_key"),
    frequency:    formData.get("frequency"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  let sealed: string;
  try {
    sealed = sealCredential(parsed.data.api_key);
  } catch {
    return { ok: false, error: "Server misconfigured (missing SCAN_CREDENTIAL_SECRET)." };
  }

  const nextRunAt = firstNextRun(parsed.data.frequency);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (supabase as any)
    .from("scheduled_scans")
    .insert({
      user_id:                     user.id,
      name:                        parsed.data.name,
      target_model:                parsed.data.target_model,
      target_url:                  parsed.data.target_url,
      target_credential_encrypted: sealed,
      frequency:                   parsed.data.frequency,
      active:                      true,
      next_run_at:                 nextRunAt.toISOString(),
    });

  if (insErr) {
    console.error("[scheduled/actions] insert:", insErr.message);
    return { ok: false, error: "Could not create schedule. Try again." };
  }

  revalidatePath("/dashboard/scheduled");
  return { ok: true };
}

/* ── Toggle active state ───────────────────────────────────────────────── */

const IdSchema = z.string().uuid();

export async function toggleSchedule(formData: FormData): Promise<void> {
  const id = IdSchema.safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("scheduled_scans")
    .update({ active })
    .eq("id", id.data)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/scheduled");
}

/* ── Delete schedule ───────────────────────────────────────────────────── */

export async function deleteSchedule(formData: FormData): Promise<void> {
  const id = IdSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("scheduled_scans")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/scheduled");
}
