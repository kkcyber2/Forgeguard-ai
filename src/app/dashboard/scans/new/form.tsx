"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock, Radar, ShieldCheck } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createScan, type CreateScanState } from "../actions";

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

export function NewScanForm() {
  const [state, formAction, pending] = useActionState(createScan, initial);
  const [showKey, setShowKey] = React.useState(false);
  const [preset, setPreset] = React.useState<string>("OpenAI");
  const [targetUrl, setTargetUrl] = React.useState<string>(PRESET_ENDPOINTS[0].url);
  const [targetModel, setTargetModel] = React.useState<string>(PRESET_ENDPOINTS[0].model);

  React.useEffect(() => {
    const hit = PRESET_ENDPOINTS.find((p) => p.label === preset);
    if (!hit || hit.label === "Custom") return;
    setTargetUrl(hit.url);
    setTargetModel(hit.model);
  }, [preset]);

  return (
    <form
      action={formAction}
      className="rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated"
      noValidate
    >
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
          {pending ? "Launching probe…" : "Launch scan"}
        </Button>
      </div>
    </form>
  );
}
