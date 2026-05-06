"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Auth Server Actions.
 * --------------------
 * All mutations that touch auth/session live here. They return a typed
 * error shape so the client component can render inline field errors
 * without leaking raw Supabase error strings to the UI.
 */

export interface AuthActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "fullName", string>>;
}

export interface MagicLinkState {
  ok: boolean;
  error?: string;
}

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

const SignupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(10, "At least 10 characters")
    .regex(/[A-Z]/, "One uppercase letter")
    .regex(/[0-9]/, "One digit"),
  fullName: z.string().min(2, "Required"),
});

export async function login(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Invalid credentials." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    error: "Check your email to confirm your account.",
  };
}

const MagicLinkSchema = z.object({
  email: z.string().email("Invalid email"),
});

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // After clicking the link the user lands on /auth/callback which
      // exchanges the token and redirects to /dashboard.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/dashboard`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { ok: false, error: "Could not send link. Try again shortly." };
  }

  return { ok: true, error: "Magic link sent — check your inbox." };
}

function flattenZod(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
