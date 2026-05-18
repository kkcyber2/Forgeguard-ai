"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock, Radar, ShieldCheck, Zap, Radiation, Activity } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createScan, type CreateScanState } from "../actions";
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

export function NewScanForm() {
  const [state, formAction, pending] = useActionState(createScan, initial);
  const [showKey,    setShowKey]    = React.useState(false);
  const [preset,     setPreset]     = React.useState<string>("OpenAI");
  const [targetUrl,  setTargetUrl]  = React.useState<string>(PRESET_ENDPOINTS[0].url);
  const [targetModel,setTargetModel]= React.useState<string>(PRESET_ENDPOINTS[0].model);
  const [intensity,  setIntensity]  = React.useState<ScanIntensity>("standard");
  const [showLegal,  setShowLegal]  = React.useState(false);
  const [authId,     setAuthId]     = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const hit = PRESET_ENDPOINTS.find((p) => p.label === preset);
    if (!hit || hit.label === "Custom") return;
    setTargetUrl(hit.url);
    setTargetModel(hit.model);
  }, [preset]);

  function handleLaunch(e: React.FormEvent) {
    const selected = INTENSITY_OPTIONS.find((o) => o.value === intensity);
    if (selected?.needsLegal && !authId) {
      e.preventDefault();
      setShowLegal(true);
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
    {showLegal && intensity !== "standard" && (
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
      {authId && <input type="hidden" name="legal_auth_id" value={authId} />}

      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        <p className="text-eyebrow text-acid">Target acquisition</p>
        <h2 className="mt-2 text-lg font-medium text-foreground">
          Configure probe
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Select an LLM provider or paste a custom endpoint. ForgeGuard
          runs the full jailbreak + prompt-injection suite against it.
        </p>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* Preset picker */}
        <div>
          <Label>Provider</Label>
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
          <Label>Scan intensity</Label>
          <div className="grid grid-cols-3 gap-2">
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
                  {opt.needsLegal && (
                    <span
                      className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                      style={{ color: opt.color, opacity: 0.7 }}
                    >
                      Legal gate
                    </span>
                  )}
                  {opt.needsLegal && authId && intensity === opt.value && (
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-green-400">
                      ✓ Authorized
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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
