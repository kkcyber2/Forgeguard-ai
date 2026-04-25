import "server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { openCredential } from "@/lib/crypto/credentials";
import { runSyntheticScan } from "./synthetic";
import type { Database } from "@/types/supabase";

/**
 * Python red-team toolkit bridge.
 * --------------------------------
 *
 * runScan() is invoked fire-and-forget from /api/scan/start. It:
 *
 *   1. Loads the scan row with the service-role client (so it sees the
 *      sealed credential and bypasses RLS for log inserts).
 *   2. Decrypts the target API key via AES-GCM.
 *   3. Decides whether to spawn the Python toolkit (preferred) or fall
 *      back to the deterministic synthetic generator (CI / dev without
 *      Python). The decision is explicit env: REDTEAM_MODE=python|synthetic.
 *   4. Streams JSONL events from the runner into `scan_logs`, while
 *      maintaining `scans.status` + `scans.progress_pct`.
 *
 * The Python toolkit is expected to print one JSON object per line on
 * stdout. Non-JSON lines are routed to a "log" event so they're still
 * visible in the live feed for debugging.
 */

type ScanStatus = Database["public"]["Tables"]["scans"]["Row"]["status"];
type LogType = Database["public"]["Tables"]["scan_logs"]["Insert"]["type"];
type LogSeverity = Database["public"]["Tables"]["scan_logs"]["Insert"]["severity"];

interface RunnerEvent {
  type: LogType;
  severity?: LogSeverity;
  attack_name?: string | null;
  payload?: unknown;
  // For 'progress' events the runner can also surface a percentage.
  progress_pct?: number;
}

interface RunScanOptions {
  scanId: string;
  userId: string;
}

const PYTHON_TOOLKIT_DIR =
  process.env.REDTEAM_TOOLKIT_DIR ??
  path.resolve(process.cwd(), "..", "Ai red");
// Bridge script (created alongside the toolkit) speaks the JSONL
// protocol this runner consumes. It is *not* the user's existing
// `run_redteam.py` CLI — that script writes HTML reports to disk and
// expects per-provider keys via Config(). The bridge takes a single
// TARGET_API_KEY in env and emits scan_logs events on stdout.
const RUNNER_ENTRY = process.env.REDTEAM_ENTRY ?? "forgeguard_bridge.py";
const PYTHON_BIN =
  process.env.REDTEAM_PYTHON ??
  (process.platform === "win32" ? "python" : "python3");

export async function runScan({ scanId, userId }: RunScanOptions): Promise<void> {
  const admin = createAdminSupabase();

  const { data: scan, error: scanErr } = await admin
    .from("scans")
    .select("id, user_id, target_model, target_url, target_credential_encrypted")
    .eq("id", scanId)
    .maybeSingle();

  if (scanErr || !scan) {
    console.error("[runner] could not load scan:", scanErr?.message);
    return;
  }
  if (scan.user_id !== userId) {
    console.error("[runner] user/scan mismatch — refusing to run");
    return;
  }

  // Decrypt the API key. If the secret is missing we can still emit a
  // structured failure log so the operator sees what happened.
  let apiKey: string;
  try {
    if (!scan.target_credential_encrypted) {
      throw new Error("No credential on scan row");
    }
    apiKey = openCredential(scan.target_credential_encrypted);
  } catch (e) {
    await markFailure(
      admin,
      scanId,
      `Could not unseal target credential: ${(e as Error).message}`,
    );
    return;
  }

  await transitionStatus(admin, scanId, "probing", { progress_pct: 1 });
  await emit(admin, scanId, {
    type: "info",
    severity: "info",
    payload: { message: "Runner started", target_model: scan.target_model },
  });

  const mode = decideMode();

  try {
    if (mode === "python") {
      await runPython({
        admin,
        scanId,
        targetModel: scan.target_model,
        targetUrl: scan.target_url,
        apiKey,
      });
    } else {
      await runSynthetic({
        admin,
        scanId,
        targetModel: scan.target_model,
        targetUrl: scan.target_url,
      });
    }

    await transitionStatus(admin, scanId, "sealed", {
      progress_pct: 100,
      completed_at: new Date().toISOString(),
    });
    await emit(admin, scanId, {
      type: "audit",
      severity: "info",
      payload: { message: "Scan sealed", mode },
    });
  } catch (err) {
    console.error("[runner] failure:", err);
    await markFailure(admin, scanId, (err as Error).message);
  }
}

/* -------------------------------------------------------------------------- */
/* Mode selection                                                             */
/* -------------------------------------------------------------------------- */

function decideMode(): "python" | "synthetic" {
  const explicit = process.env.REDTEAM_MODE?.toLowerCase();
  if (explicit === "python" || explicit === "synthetic") return explicit;

  // Auto: prefer Python iff the toolkit + entry script are present.
  const entry = path.join(PYTHON_TOOLKIT_DIR, RUNNER_ENTRY);
  if (existsSync(entry)) return "python";
  return "synthetic";
}

/* -------------------------------------------------------------------------- */
/* Python branch                                                              */
/* -------------------------------------------------------------------------- */

interface PythonRunArgs {
  admin: ReturnType<typeof createAdminSupabase>;
  scanId: string;
  targetModel: string;
  targetUrl: string;
  apiKey: string;
}

function runPython(args: PythonRunArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    const entry = path.join(PYTHON_TOOLKIT_DIR, RUNNER_ENTRY);
    const child = spawn(
      PYTHON_BIN,
      [
        entry,
        "--scan-id",
        args.scanId,
        "--target-model",
        args.targetModel,
        "--target-url",
        args.targetUrl,
      ],
      {
        cwd: PYTHON_TOOLKIT_DIR,
        env: {
          ...process.env,
          // Pass the API key out-of-band via env so it never appears in
          // command lines / process listings.
          TARGET_API_KEY: args.apiKey,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdoutBuf = "";
    let stderrBuf = "";

    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuf += chunk;
      let nl: number;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        void handleStdoutLine(args.admin, args.scanId, line);
      }
    });

    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuf += chunk;
      // Don't drown the log table in stderr — only flush once the
      // process exits with non-zero.
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      // Flush whatever is left in the line buffer.
      if (stdoutBuf.trim()) {
        void handleStdoutLine(args.admin, args.scanId, stdoutBuf.trim());
      }
      if (code === 0) {
        resolve();
      } else {
        const tail = stderrBuf.trim().split("\n").slice(-10).join("\n");
        void emit(args.admin, args.scanId, {
          type: "error",
          severity: "high",
          payload: { message: `Runner exited with code ${code}`, stderr: tail },
        });
        reject(new Error(`Python runner exited ${code}`));
      }
    });
  });
}

async function handleStdoutLine(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  line: string,
): Promise<void> {
  let parsed: RunnerEvent | null = null;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    if (obj && typeof obj.type === "string") {
      parsed = {
        type: (obj.type as LogType) ?? "info",
        severity: (obj.severity as LogSeverity) ?? "info",
        attack_name: (obj.attack_name as string) ?? null,
        payload: obj.payload ?? obj,
        progress_pct:
          typeof obj.progress_pct === "number" ? obj.progress_pct : undefined,
      };
    }
  } catch {
    // Not JSON — treat as a plain info line.
  }

  if (!parsed) {
    parsed = {
      type: "info",
      severity: "info",
      payload: { message: line },
    };
  }

  if (
    typeof parsed.progress_pct === "number" &&
    parsed.progress_pct >= 0 &&
    parsed.progress_pct <= 100
  ) {
    await admin
      .from("scans")
      .update({ progress_pct: Math.round(parsed.progress_pct) })
      .eq("id", scanId);
  }

  await emit(admin, scanId, parsed);
}

/* -------------------------------------------------------------------------- */
/* Synthetic branch (no Python required)                                       */
/* -------------------------------------------------------------------------- */

async function runSynthetic(args: {
  admin: ReturnType<typeof createAdminSupabase>;
  scanId: string;
  targetModel: string;
  targetUrl: string;
}): Promise<void> {
  await emit(args.admin, args.scanId, {
    type: "info",
    severity: "info",
    payload: {
      message:
        "Python toolkit not detected; running deterministic synthetic suite.",
    },
  });

  for await (const ev of runSyntheticScan({
    targetModel: args.targetModel,
    targetUrl: args.targetUrl,
  })) {
    if (typeof ev.progress_pct === "number") {
      await args.admin
        .from("scans")
        .update({ progress_pct: Math.round(ev.progress_pct) })
        .eq("id", args.scanId);
    }
    await emit(args.admin, args.scanId, ev);
  }
}

/* -------------------------------------------------------------------------- */
/* Supabase helpers                                                           */
/* -------------------------------------------------------------------------- */

async function emit(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  ev: RunnerEvent,
): Promise<void> {
  const { error } = await admin.from("scan_logs").insert({
    scan_id: scanId,
    type: ev.type,
    severity: ev.severity ?? "info",
    attack_name: ev.attack_name ?? null,
    payload: (ev.payload ?? null) as Database["public"]["Tables"]["scan_logs"]["Insert"]["payload"],
  });
  if (error) {
    console.error("[runner] log insert failed:", error.message);
  }
}

async function transitionStatus(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  status: ScanStatus,
  patch: Partial<Database["public"]["Tables"]["scans"]["Update"]> = {},
): Promise<void> {
  const update: Database["public"]["Tables"]["scans"]["Update"] = {
    status,
    ...patch,
  };
  if (status === "probing" && !patch.started_at) {
    update.started_at = new Date().toISOString();
  }
  const { error } = await admin.from("scans").update(update).eq("id", scanId);
  if (error) {
    console.error("[runner] status transition failed:", error.message);
  }
}

async function markFailure(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  message: string,
): Promise<void> {
  await emit(admin, scanId, {
    type: "error",
    severity: "high",
    payload: { message },
  });
  await transitionStatus(admin, scanId, "failed", {
    progress_pct: 100,
    completed_at: new Date().toISOString(),
  });
}
