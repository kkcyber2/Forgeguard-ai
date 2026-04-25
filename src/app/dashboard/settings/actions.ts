"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Settings Server Actions.
 * ------------------------
 * Two surfaces:
 *   - updateProfile: full_name + company_name + phone
 *   - updatePassword: requires current password (re-auth) before set
 *
 * Both run under the user's session — RLS guarantees they can only
 * update their own row.
 */

export interface SettingsState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

const ProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name is too short")
    .max(80, "Name is too long")
    .nullable()
    .or(z.literal("").transform(() => null)),
  company_name: z
    .string()
    .max(120, "Too long")
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: z
    .string()
    .max(40, "Too long")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

function flattenZod(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = ProfileSchema.safeParse({
    full_name: (formData.get("full_name") as string | null) ?? null,
    company_name: (formData.get("company_name") as string | null) ?? null,
    phone: (formData.get("phone") as string | null) ?? null,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      company_name: parsed.data.company_name,
      phone: parsed.data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[settings] profile update:", error.message);
    return { ok: false, error: "Could not save profile." };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}

const PasswordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(10, "At least 10 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export async function updatePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = PasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Not authenticated." };

  // Re-auth: signing in with the current password validates ownership.
  // This also refreshes the session cookies.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (reauthErr) {
    return {
      ok: false,
      fieldErrors: { current_password: "That password didn't work." },
    };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (updateErr) {
    console.error("[settings] password update:", updateErr.message);
    return { ok: false, error: updateErr.message };
  }

  return { ok: true, message: "Password updated." };
}
