"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sealCredential } from "@/lib/crypto/credentials";
import { headers } from "next/headers";

/**
 * Scan Server Actions.
 * --------------------
 * - createScan: called from /dashboard/scans/new. Validates, writes the
 *   scan row (RLS-scoped to auth.uid()), seals the API key with AES-GCM,
 *   fires /api/scan/start to kick the runner, then redirects to the
 *   detail page. If the runner isn't reachable the scan stays in
 *   `queued` and can be retried.
 * - deleteScan: called from the detail or list page.
 */

export interface CreateScanState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"target_model" | "target_url" | "api_key" | "notes", string>
  >;
}

const CreateScanSchema = z.object({
  target_model: z
    .string()
    .min(2, "Required")
    .max(80, "Too long"),
  target_url: z
    .string()
    .url("Must be a full URL, like https://api.example.com/v1/chat/completions"),
  api_key: z
    .string()
    .min(8, "API key looks too short")
    .max(2048, "API key too long"),
  notes: z.string().max(2000).optional().nullable(),
});

function flattenZod(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function createScan(
  _prev: CreateScanState,
  formData: FormData,
): Promise<CreateScanState> {
  const parsed = CreateScanSchema.safeParse({
    target_model: formData.get("target_model"),
    target_url: formData.get("target_url"),
    api_key: formData.get("api_key"),
    notes: formData.get("notes") || null,
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
  } catch (err) {
    console.error("[scans] seal failed:", err);
    return {
      ok: false,
      error:
        "Server misconfigured (missing SCAN_CREDENTIAL_SECRET). Contact the administrator.",
    };
  }

  // Cast through `any` because the Supabase v2 typings collapse the
  // `.insert()` argument to `never` when the cookie-bound SSR client and
  // the bare supabase-js client expose different generic arities. Runtime
  // is unchanged — we just lose the per-column typecheck on this one call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scan, error: insErr } = (await (supabase as any)
    .from("scans")
    .insert({
      user_id: user.id,
      target_model: parsed.data.target_model,
      target_url: parsed.data.target_url,
      target_credential_encrypted: sealed,
      status: "queued",
      progress_pct: 0,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (insErr || !scan) {
    console.error("[scans] insert failed:", insErr?.message);
    return { ok: false, error: "Could not create scan. Try again." };
  }

  // Kick the runner. We MUST await this — Vercel Server Actions terminate
  // the serverless invocation as soon as `redirect()` throws, so any
  // unawaited fetch gets garbage-collected before the network request goes
  // out. Awaiting forces the function to stay alive until Railway responds.
  //
  // The Railway orchestrator's /scan/start handler returns immediately
  // (~200-500ms) — it dispatches the actual scan to a background task — so
  // the user only waits a fraction of a second for the redirect.
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const origin = `${proto}://${host}`;
    // The Server Action runs under the user's session cookies; we
    // forward them so /api/scan/start can authorise via getUser().
    const cookie = h.get("cookie") ?? "";
    const dispatchResp = await fetch(`${origin}/api/scan/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ scan_id: scan.id }),
      // Bail out if Vercel→Vercel routing is somehow slow; the scan row
      // stays in 'queued' and the user can retry.
      signal: AbortSignal.timeout(20_000),
    });
    if (!dispatchResp.ok) {
      const body = await dispatchResp.text().catch(() => "<no body>");
      console.error(
        "[scans] runner kickoff returned",
        dispatchResp.status,
        body.slice(0, 400),
      );
    }
  } catch (e) {
    // We log + swallow — the scan row exists in 'queued' and can be
    // resumed. We don't want to block the redirect on a transient kickoff
    // failure (e.g. Railway cold start hitting the 20s budget).
    console.error("[scans] runner kickoff error:", e);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scans");
  redirect(`/dashboard/scans/${scan.id}`);
}

const DeleteSchema = z.object({ scan_id: z.string().uuid() });

export async function deleteScan(formData: FormData): Promise<void> {
  const parsed = DeleteSchema.safeParse({ scan_id: formData.get("scan_id") });
  if (!parsed.success) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS allows owners + admins; no extra guard needed.
  await supabase.from("scans").delete().eq("id", parsed.data.scan_id);
  revalidatePath("/dashboard/scans");
  revalidatePath("/dashboard");
  redirect("/dashboard/scans");
}

/** Utility used by the API route — redacts the credential from any payload. */
export async function fetchScanForRunner(scanId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
