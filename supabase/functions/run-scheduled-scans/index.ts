/**
 * run-scheduled-scans — Supabase Edge Function
 * ──────────────────────────────────────────────────────────────────────────
 * Fires every minute via pg_cron. Finds scheduled_scans rows that are due,
 * creates a new scan for each one, then updates last_run_at / next_run_at.
 *
 * This function is idempotent — if nothing is due it returns immediately.
 * It is NOT triggered by a DB webhook; instead it is called by pg_cron
 * via net.http_post() (see sql/scheduled_scans.sql for setup).
 *
 * Required secrets (supabase secrets set):
 *   APP_URL   — e.g. https://forgeguard.ai  (used to kick /api/scan/start)
 *
 * The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
 * by the Supabase runtime.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ScheduledScan {
  id: string;
  user_id: string;
  name: string;
  target_model: string;
  target_url: string;
  target_credential_encrypted: string;
  frequency: "daily" | "weekly" | "monthly";
  next_run_at: string;
}

const FREQ_OFFSET: Record<string, number> = {
  daily:   1,
  weekly:  7,
  monthly: 30,
};

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl      = Deno.env.get("APP_URL") ?? "https://forgeguard.ai";

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Fetch all due schedules
  const now = new Date().toISOString();
  const { data: dueSans, error: fetchErr } = await admin
    .from("scheduled_scans")
    .select("id, user_id, name, target_model, target_url, target_credential_encrypted, frequency, next_run_at")
    .eq("active", true)
    .lte("next_run_at", now);

  if (fetchErr) {
    console.error("[run-scheduled-scans] fetch error:", fetchErr.message);
    return new Response("fetch error", { status: 500 });
  }

  if (!dueSans || dueSans.length === 0) {
    return new Response("nothing due", { status: 200 });
  }

  console.log(`[run-scheduled-scans] ${dueSans.length} schedule(s) due`);

  const results: string[] = [];

  for (const schedule of dueSans as ScheduledScan[]) {
    try {
      // 2. Create a new scan row
      const { data: scan, error: insErr } = await admin
        .from("scans")
        .insert({
          user_id: schedule.user_id,
          target_model: schedule.target_model,
          target_url: schedule.target_url,
          target_credential_encrypted: schedule.target_credential_encrypted,
          status: "queued",
          progress_pct: 0,
          notes: `Scheduled run — ${schedule.name}`,
        })
        .select("id")
        .single();

      if (insErr || !scan) {
        console.error(`[run-scheduled-scans] insert for ${schedule.id}:`, insErr?.message);
        continue;
      }

      const scanId = (scan as { id: string }).id;
      results.push(scanId);

      // 3. Kick the runner (fire-and-forget is fine here; scan stays queued if runner is down)
      fetch(`${appUrl}/api/scan/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scan_id: scanId }),
        signal: AbortSignal.timeout(20_000),
      }).catch((e) => console.warn("[run-scheduled-scans] runner kickoff:", e));

      // 4. Advance next_run_at
      const daysToAdd = FREQ_OFFSET[schedule.frequency] ?? 7;
      const nextRunAt = new Date();
      nextRunAt.setDate(nextRunAt.getDate() + daysToAdd);

      await admin
        .from("scheduled_scans")
        .update({
          last_run_at: now,
          next_run_at: nextRunAt.toISOString(),
        })
        .eq("id", schedule.id);

      console.log(`[run-scheduled-scans] created scan ${scanId} for schedule ${schedule.id}`);
    } catch (err) {
      console.error(`[run-scheduled-scans] unexpected error for ${schedule.id}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ triggered: results.length, scan_ids: results }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
