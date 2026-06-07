/**
 * POST /api/v1/scans
 * ──────────────────────────────────────────────────────────────────────────
 * CI/CD-friendly REST endpoint. Accepts a Bearer API key, validates it
 * against the user_api_keys table (SHA-256 hash comparison), creates a
 * scan row, kicks the runner, and returns the scan ID + detail URL so
 * GitHub Actions / deployment pipelines can poll for results.
 *
 * Authentication
 * ──────────────
 *   Authorization: Bearer fg_<hex_key>
 *
 * Request body (JSON)
 * ───────────────────
 *   {
 *     "target_model": "gpt-4o",          // required — model identifier
 *     "target_url":   "https://…/v1/chat/completions",  // required
 *     "api_key":      "sk-…",            // required — target model's key
 *     "notes":        "Deploy #1234"     // optional
 *   }
 *
 * Success response (201)
 * ──────────────────────
 *   {
 *     "scan_id": "<uuid>",
 *     "status":  "queued",
 *     "url":     "https://<app>/dashboard/scans/<uuid>"
 *   }
 *
 * Error responses
 * ───────────────
 *   400  missing / invalid fields
 *   401  missing or invalid API key
 *   429  rate limit (future)
 *   500  internal error
 *
 * Example (GitHub Actions)
 * ─────────────────────────
 *   - name: Trigger ForgeGuard scan
 *     run: |
 *       RESPONSE=$(curl -s -X POST https://your-app.com/api/v1/scans \
 *         -H "Authorization: Bearer ${{ secrets.FORGEGUARD_API_KEY }}" \
 *         -H "Content-Type: application/json" \
 *         -d '{"target_model":"gpt-4o","target_url":"${{ vars.AI_ENDPOINT }}","api_key":"${{ secrets.AI_API_KEY }}"}')
 *       echo "Scan: $(echo $RESPONSE | jq -r .url)"
 */

import { NextRequest, NextResponse } from "next/server";
import { sha256hex } from "@/lib/crypto/hash";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { sealCredential } from "@/lib/crypto/credentials";
import { launchScan } from "@/services/scan-launcher.service";
import {
  normalizeSurfaceKind,
} from "@/lib/scans/surface-kind";

export const runtime = "nodejs"; // needs crypto module

// ── Validation ──────────────────────────────────────────────────────────────

const ScanSchema = z.object({
  target_model: z.string().min(2).max(80),
  target_url: z
    .string()
    .url("Must be a full URL — e.g. https://api.openai.com/v1/chat/completions"),
  api_key: z.string().min(8).max(2048),
  surface_kind: z
    .string()
    .optional()
    .transform((v) => normalizeSurfaceKind(v)),
  target_type: z
    .string()
    .optional()
    .transform((v) => (v ? normalizeSurfaceKind(v) : undefined)),
  notes: z.string().max(2000).optional().nullable(),
}).transform((data) => ({
  ...data,
  surface_kind: data.target_type ?? data.surface_kind ?? "llm",
}));

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Extract Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token || !token.startsWith("fg_")) {
    return json(
      { error: "Missing or invalid API key. Expected: Authorization: Bearer fg_<key>" },
      401,
    );
  }

  // 2. Hash token and look up in DB
  const tokenHash = sha256hex(token);
  const admin = createAdminSupabase();

  const { data: keyRow, error: keyErr } = await admin
    .from("user_api_keys")
    .select("id, user_id, revoked_at, last_used_at")
    .eq("key_hash", tokenHash)
    .maybeSingle();

  if (keyErr) {
    console.error("[api/v1/scans] key lookup error:", keyErr.message);
    return json({ error: "Internal error" }, 500);
  }

  if (!keyRow || keyRow.revoked_at) {
    return json({ error: "Invalid or revoked API key" }, 401);
  }

  const userId = keyRow.user_id as string;

  // Resolve owner email via service-role (bypasses RLS on profiles).
  const { data: profileRow } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const userEmail = (profileRow?.email as string | undefined) ?? null;
  const isSovereign = isSovereignOperator(userEmail);

  // Enterprise plan gate — sovereign operator bypasses tier/quota checks.
  if (!isSovereign) {
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (subRow?.plan as string | null) ?? "free";
    const subStatus = (subRow?.status as string | null) ?? "inactive";
    const isEnterprise =
      plan === "enterprise" &&
      (subStatus === "active" || subStatus === "trialing");

    if (!isEnterprise) {
      return json(
        {
          error: "PLAN_UPGRADE_REQUIRED",
          message:
            "REST API access requires the Enterprise plan. Upgrade at /dashboard/billing.",
          currentPlan: plan,
          requiredPlan: "enterprise",
        },
        403,
      );
    }
  }

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_"] = issue.message;
    }
    return json({ error: "Validation failed", fieldErrors }, 400);
  }

  const { target_model, target_url, api_key, surface_kind, notes } = parsed.data;

  // 4. Seal the target API key
  let sealed: string;
  try {
    sealed = sealCredential(api_key);
  } catch (err) {
    console.error("[api/v1/scans] seal failed:", err);
    return json(
      { error: "Server misconfigured (missing SCAN_CREDENTIAL_SECRET)" },
      500,
    );
  }

  // 5. Insert scan row (as the key owner — userId declared in step 2b above)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scan, error: insErr } = await (admin as any)
    .from("scans")
    .insert({
      user_id: userId,
      target_model,
      target_url,
      target_credential_encrypted: sealed,
      surface_kind,
      status: "queued",
      progress_pct: 0,
      intensity: "standard",
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (insErr || !scan) {
    console.error("[api/v1/scans] insert error:", insErr?.message);
    return json({ error: "Could not create scan" }, 500);
  }

  const scanId = (scan as { id: string }).id;

  // 6. Update key last_used_at (fire-and-forget — non-blocking)
  admin
    .from("user_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {/* ignore */});

  // 7. Dispatch scan via shared launcher (no session cookies required)
  const launch = await launchScan({ scanId, userId, userEmail });
  if (!launch.ok) {
    console.warn(
      "[api/v1/scans] launchScan failed:",
      launch.status,
      launch.error.slice(0, 200),
    );
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `https://${req.headers.get("host") ?? "localhost:3000"}`;
    return json(
      {
        scan_id: scanId,
        status: "queued",
        error: launch.error,
        code: launch.code ?? "DISPATCH_FAILED",
        url: `${appUrl}/dashboard/scans/${scanId}`,
      },
      launch.status >= 400 && launch.status < 600 ? launch.status : 502,
    );
  }
  const launchStatus = launch.alreadyRunning ? "probing" : "probing";

  // 8. Return scan reference
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${req.headers.get("host") ?? "localhost:3000"}`;

  return json(
    {
      scan_id: scanId,
      status: launchStatus,
      url: `${appUrl}/dashboard/scans/${scanId}`,
    },
    201,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

// ── GET — documentation stub ──────────────────────────────────────────────────
export async function GET() {
  return json(
    {
      endpoint: "POST /api/v1/scans",
      auth: "Authorization: Bearer fg_<your_api_key>",
      body: {
        target_model: "string (required)",
        target_url: "string (required, full URL)",
        api_key: "string (required, your target model's API key)",
        notes: "string (optional)",
      },
      response: {
        scan_id: "uuid",
        status: "queued",
        url: "https://…/dashboard/scans/<uuid>",
      },
    },
    200,
  );
}
