"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock, Radar, ShieldCheck, Zap, Radiation, Activity, Copy, CheckCircle2, Bot, Globe, Server, MessageSquare } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createScan, type CreateScanState } from "../actions";
import { issueScanOwnershipToken, verifyScanOwnership } from "../ownership-actions";
import { LegalVerificationModal } from "@/components/scans/LegalVerificationModal";
import type { LegalIntensity } from "../legal-actions";

/**
 * NewScanForm — client-side wrapper around the `createScan` Server Action.
 *
 * The shape is intentionally narrow: four fields, no JSON editor, no
 * exotic auth modes. Everything else (headers, rate limits, probe
 * catalogue) is configured server-side. Keeping the surface area small
 * makes it easy to spot misuse.
 *
 * UX notes:
 *   - API key input is masked by default; toggle reveals it briefly.
 *   - Submit is disabled until all required fields pass local validation,
 *     but server-side zod is still the source of truth.
 *   - On success the action redirects to /dashboard/scans/{id}, so we
 *     never actually render state.ok=true here.
 */

const initial: CreateScanState = { ok: false };

const PRESET_ENDPOINTS = [
  {
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-70b-versatile",
  },
  {
    label: "Anthropic",
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-sonnet-latest",
  },
  {
    label: "Custom",
    url: "",
    model: "",
  },
] as const;

type SurfaceKind = "llm" | "web" | "code" | "mobile";

const TARGET_TYPES: {
  value: SurfaceKind;
  label: string;
  badge?: string;
  icon: React.ElementType;
  modules: string[];
}[] = [
  {
    value: "llm",
    label: "LLM ENDPOINT",
    badge: "Industry Standard Red-Teaming",
    icon: Bot,
    modules: ["Prompt Hijacker", "Jailbreak Mutator", "Garak Catalogue (400+)"],
  },
  {
    value: "web",
    label: "WEB APPLICATION",
    badge: "Beta Probe",
    icon: Globe,
    modules: ["Logic Discovery", "XSS Vector Scout", "Client Gateway Crawl"],
  },
  {
    value: "code",
    label: "API GATEWAY",
    badge: "Beta Probe",
    icon: Server,
    modules: ["BOLA/IDOR Sweep", "UUID IDOR Fuzz", "Hidden User Exfiltration"],
  },
  {
    value: "mobile",
    label: "CHAT BOT",
    badge: "Beta Probe",
    icon: MessageSquare,
    modules: ["Intent Drift Harness", "Tool-Call Injection", "PyRIT Scenarios"],
  },
];

/* ── Intensity selector config ─────────────────────────────────────── */
type ScanIntensity = "standard" | LegalIntensity;

const INTENSITY_OPTIONS: {
  value:    ScanIntensity;
  label:    string;
  sublabel: string;
  Icon:     React.ElementType;
  color:    string;
  needsLegal: boolean;
}[] = [
  {
    value:      "standard",
    label:      "Standard",
    sublabel:   "Full suite, rate-limited",
    Icon:       Activity,
    color:      "rgba(209,255,0,1)",
    needsLegal: false,
  },
  {
    value:      "high",
    label:      "High",
    sublabel:   "Aggressive mutations",
    Icon:       Zap,
    color:      "rgb(251,191,36)",
    needsLegal: true,
  },
  {
    value:      "nuclear",
    label:      "Nuclear",
    sublabel:   "Marine Swarm unleashed",
    Icon:       Radiation,
    color:      "rgb(239,68,68)",
    needsLegal: true,
  },
];

export type ScanQuotaSnapshot = {
  plan: string;
  scansUsed: number;
  scansAllowed: number;
};

export function NewScanForm({
  isSovereign = false,
  quota = null,
}: {
  isSovereign?: boolean;
  quota?: ScanQuotaSnapshot | null;
}) {
  const [state, formAction, pending] = useActionState(createScan, initial);
  const [showKey,    setShowKey]    = React.useState(false);
  const [preset,     setPreset]     = React.useState<string>("OpenAI");
  const [targetUrl,  setTargetUrl]  = React.useState<string>(PRESET_ENDPOINTS[0].url);
  const [targetModel,setTargetModel]= React.useState<string>(PRESET_ENDPOINTS[0].model);
  const [intensity,  setIntensity]  = React.useState<ScanIntensity>("standard");
  const [showLegal,  setShowLegal]  = React.useState(false);
  const [authId,     setAuthId]     = React.useState<string | null>(null);
  const [surfaceKind,setSurfaceKind]= React.useState<SurfaceKind>("llm");
  const [assetValue, setAssetValue] = React.useState<string>("");
  const [ownershipToken, setOwnershipToken] = React.useState<string | null>(null);
  const [ownershipVerified, setOwnershipVerified] = React.useState(false);
  const [ownershipBusy, setOwnershipBusy] = React.useState(false);
  const [ownershipMsg, setOwnershipMsg] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const hit = PRESET_ENDPOINTS.find((p) => p.label === preset);
    if (!hit || hit.label === "Custom") return;
    setTargetUrl(hit.url);
    setTargetModel(hit.model);
  }, [preset]);

  React.useEffect(() => {
    if (isSovereign) return;
    setOwnershipVerified(false);
    setOwnershipToken(null);
    setOwnershipMsg(null);
  }, [targetUrl, intensity, isSovereign]);

  const selectedTarget = TARGET_TYPES.find((t) => t.value === surfaceKind)!;
  const setTargetType = setSurfaceKind;
  const needsOwnership = intensity !== "standard";

  async function handleIssueToken() {
    if (!targetUrl) {
      setOwnershipMsg("Enter target URL first.");
      return;
    }
    setOwnershipBusy(true);
    setOwnershipMsg(null);
    const res = await issueScanOwnershipToken(targetUrl);
    setOwnershipBusy(false);
    if (res.error) {
      setOwnershipMsg(res.error);
      return;
    }
    setOwnershipToken(res.token ?? null);
    setOwnershipVerified(false);
    setOwnershipMsg(`Place token in https://${res.host}/auth.txt then verify.`);
  }

  async function handleVerifyOwnership() {
    if (!targetUrl || !ownershipToken) return;
    setOwnershipBusy(true);
    const res = await verifyScanOwnership(targetUrl, ownershipToken);
    setOwnershipBusy(false);
    setOwnershipVerified(res.verified);
    setOwnershipMsg(res.detail);
  }

  function handleLaunch(e: React.FormEvent) {
    if (isSovereign) return;
    const selected = INTENSITY_OPTIONS.find((o) => o.value === intensity);
    if (selected?.needsLegal && !authId) {
      e.preventDefault();
      setShowLegal(true);
      return;
    }
    if (needsOwnership && !ownershipVerified) {
      e.preventDefault();
      setOwnershipMsg("Verify proof of ownership before launching above Standard intensity.");
    }
    // else: let the form submit naturally via formAction
  }

  function handleAuthorized(id: string) {
    setAuthId(id);
    setShowLegal(false);
    // Submit the form now that auth is in place
    setTimeout(() => formRef.current?.requestSubmit(), 50);
  }

  return (
    <>
    {showLegal && !isSovereign && intensity !== "standard" && (
      <LegalVerificationModal
        intensity={intensity as LegalIntensity}
        onAuthorized={handleAuthorized}
        onCancel={() => setShowLegal(false)}
      />
    )}
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleLaunch}
      className="rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated"
      noValidate
    >
      {/* Hidden fields for intensity + auth */}
      <input type="hidden" name="intensity" value={intensity} />
      <input type="hidden" name="surface_kind" value={surfaceKind} />
      <input type="hidden" name="target_type" value={surfaceKind} />
      {ownershipToken && (
        <input type="hidden" name="ownership_token" value={ownershipToken} />
      )}
      {authId && <input type="hidden" name="legal_auth_id" value={authId} />}

      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        {isSovereign && (
          <p className="mb-3 inline-flex items-center gap-2 rounded-sm border border-acid/40 bg-acid/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-acid">
            <ShieldCheck size={12} strokeWidth={1.75} />
            VERIFIED: SOVEREIGN
          </p>
        )}
        <p className="text-eyebrow text-acid">Target acquisition</p>
        <h2 className="mt-2 text-lg font-medium text-foreground">
          Configure probe
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Select a target integration or paste a custom endpoint. ForgeGuard
          runs the full jailbreak + prompt-injection suite against it.
        </p>
        {!isSovereign && quota && quota.scansAllowed < 999_999 && (
          <p className="mt-3 font-mono text-[11px] text-foreground-subtle">
            Scan quota:{" "}
            <span className="text-acid tabular-nums">
              {quota.scansUsed} / {quota.scansAllowed}
            </span>{" "}
            this period ({quota.plan === "startup" ? "Startup" : quota.plan === "enterprise" ? "Enterprise" : "Free"})
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 px-6 py-6">
        {/* Target type */}
        <div>
          <Label>Target type</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TARGET_TYPES.map((t) => {
              const active = surfaceKind === t.value;
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setTargetType(t.value);
                  }}
                  data-target-type={t.value}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-acid/40 bg-acid-wash"
                      : "border-white/10 bg-obsidian-800/40 hover:border-white/20",
                  )}
                >
                  <Icon
                    size={16}
                    className={active ? "text-acid" : "text-white/35"}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "font-mono text-[10px] font-semibold uppercase tracking-widest",
                          active ? "text-acid" : "text-white/55",
                        )}
                      >
                        {t.label}
                      </p>
                      {t.badge && (
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider",
                            t.value === "llm"
                              ? "border border-acid/30 bg-acid/10 text-acid"
                              : "border border-amber-400/25 bg-amber-400/10 text-amber-300/90",
                          )}
                        >
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-white/35">
                      {t.modules.slice(0, 2).join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactical modules */}
        <div className="rounded-sm border border-white/10 bg-obsidian-900/50 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-acid/80">
            Tactical modules
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {selectedTarget.modules.map((mod) => (
              <li
                key={mod}
                className="flex items-center gap-2 font-mono text-[11px] text-white/70"
              >
                <span className="h-1 w-1 rounded-full bg-acid" />
                {mod}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Label htmlFor="asset_value_usd">Estimated Value of Data Access</Label>
          <Input
            id="asset_value_usd"
            name="asset_value_usd"
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            placeholder="500000"
            value={assetValue}
            onChange={(e) => setAssetValue(e.target.value)}
            aria-invalid={!!state.fieldErrors?.asset_value_usd}
            className="font-mono text-xs tabular-nums"
          />
          <FieldError>{state.fieldErrors?.asset_value_usd}</FieldError>
          <p className="mt-2 text-[11px] leading-relaxed text-foreground-subtle">
            USD estimate of data exposed if breached — drives the $ALE liability
            calculation. Leave blank to use intensity-tier defaults.
          </p>
        </div>

        {/* Preset picker */}
        <div>
          <Label>Target Integration</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESET_ENDPOINTS.map((p) => {
              const active = preset === p.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPreset(p.label)}
                  className={cn(
                    "h-9 rounded-sm border-hairline text-xs font-medium transition-colors",
                    active
                      ? "border-acid/40 bg-acid-wash text-acid"
                      : "border-white/10 bg-obsidian-800/60 text-foreground-muted hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="target_model">Model identifier</Label>
            <Input
              id="target_model"
              name="target_model"
              required
              placeholder="gpt-4o-mini"
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
              aria-invalid={!!state.fieldErrors?.target_model}
            />
            <FieldError>{state.fieldErrors?.target_model}</FieldError>
          </div>
          <div>
            <Label htmlFor="target_url">Endpoint URL</Label>
            <Input
              id="target_url"
              name="target_url"
              type="url"
              required
              inputMode="url"
              placeholder="https://api.provider.com/v1/chat/completions"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              aria-invalid={!!state.fieldErrors?.target_url}
              className="font-mono text-xs"
            />
            <FieldError>{state.fieldErrors?.target_url}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="api_key">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={10} strokeWidth={2} />
              API key
            </span>
          </Label>
          <div className="relative">
            <Input
              id="api_key"
              name="api_key"
              type={showKey ? "text" : "password"}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              aria-invalid={!!state.fieldErrors?.api_key}
              className="pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              tabIndex={-1}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-subtle transition-colors hover:text-foreground"
            >
              {showKey ? (
                <EyeOff size={14} strokeWidth={1.75} />
              ) : (
                <Eye size={14} strokeWidth={1.75} />
              )}
            </button>
          </div>
          <FieldError>{state.fieldErrors?.api_key}</FieldError>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-subtle">
            <ShieldCheck
              size={11}
              strokeWidth={1.75}
              className="mt-[2px] text-acid/80"
            />
            Sealed with AES-256-GCM + per-row salt before insert. The
            plaintext never leaves the request boundary.
          </p>
        </div>

        {/* ── Intensity selector ──────────────────────────────────── */}
        <div>
          <Label>Strike Power</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {INTENSITY_OPTIONS.map((opt) => {
              const active = intensity === opt.value;
              const OptIcon = opt.Icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setIntensity(opt.value); setAuthId(null); }}
                  className="relative flex flex-col items-start rounded-sm px-3 py-2.5 text-left transition-all"
                  style={{
                    background: active ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                    border: active
                      ? `0.5px solid ${opt.color}50`
                      : "0.5px solid rgba(255,255,255,0.08)",
                    boxShadow: active ? `0 0 16px ${opt.color}18` : "none",
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <OptIcon size={12} style={{ color: active ? opt.color : "rgba(255,255,255,0.3)" }} strokeWidth={1.75} />
                    <span
                      className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: active ? opt.color : "rgba(255,255,255,0.4)" }}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/30">{opt.sublabel}</span>
                  {opt.needsLegal && !isSovereign && (
                    <span
                      className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                      style={{ color: opt.color, opacity: 0.7 }}
                    >
                      Legal gate
                    </span>
                  )}
                  {opt.needsLegal && !isSovereign && authId && intensity === opt.value && (
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-green-400">
                      ✓ Authorized
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {needsOwnership && !isSovereign && (
          <div className="rounded-sm border border-amber-400/25 bg-amber-400/5 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-300">
              Proof of ownership
            </p>
            <p className="mt-2 text-xs text-white/55">
              Copy your unique token into the target&apos;s{" "}
              <code className="text-amber-200">auth.txt</code> before High or Nuclear
              scans can launch.
            </p>
            {ownershipToken && (
              <div className="mt-3 flex flex-col gap-2 rounded-sm border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center">
                <code className="flex-1 break-all font-mono text-[10px] text-white/75">
                  {ownershipToken}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(ownershipToken)}
                  className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-white/50"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleIssueToken}
                disabled={ownershipBusy}
                className="rounded-sm border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/70"
              >
                Issue token
              </button>
              <button
                type="button"
                onClick={handleVerifyOwnership}
                disabled={ownershipBusy || !ownershipToken}
                className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-acid/15 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-acid disabled:opacity-40"
              >
                {ownershipVerified ? <CheckCircle2 size={12} /> : null}
                Verify ownership
              </button>
            </div>
            {ownershipMsg && (
              <p className="mt-2 text-xs text-white/50">{ownershipMsg}</p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="notes">
            Notes <span className="opacity-50">(optional)</span>
          </Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Context for triage — deploy target, ticket, production vs. staging, anything your future self will thank you for."
            className={cn(
              "flex w-full rounded-sm bg-obsidian-800/70 px-3 py-2 text-sm",
              "border-hairline border-white/10 text-foreground placeholder:text-foreground-subtle",
              "transition-colors duration-150",
              "focus:border-acid/60 focus:bg-obsidian-800",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-acid/40",
              "resize-none",
            )}
          />
          <FieldError>{state.fieldErrors?.notes}</FieldError>
        </div>

        {state.error && !state.ok ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
          >
            <AlertTriangle size={12} strokeWidth={1.75} className="mt-[2px] shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t-[0.5px] border-white/[0.06] bg-obsidian-900/40 px-6 py-4">
        <Link
          href="/dashboard/scans"
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          <Radar size={14} strokeWidth={1.75} />
          {pending ? "Initializing Breach Simulation..." : "Launch scan"}
        </Button>
      </div>
    </form>
    </>
  );
}
