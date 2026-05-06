"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowUpRight, Lock, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { login, sendMagicLink, type AuthActionState, type MagicLinkState } from "../actions";

const initialLogin: AuthActionState = { ok: false };
const initialMagic: MagicLinkState = { ok: false };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialLogin);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, initialMagic);
  const [useMagic, setUseMagic] = React.useState(false);

  return (
    <div className="relative rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        <p className="text-eyebrow text-acid">Access channel</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Sign in to your command center
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Continue with a provider or your email below.
        </p>
      </div>

      {/* ── OAuth providers ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-5">
        <OAuthButtons mode="signin" divider={!useMagic} />
      </div>

      {/* ── Toggle: password / magic link ───────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 pb-1">
        <button
          type="button"
          onClick={() => setUseMagic(false)}
          className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
            !useMagic
              ? "bg-white/[0.06] text-foreground"
              : "text-foreground-subtle hover:text-foreground"
          }`}
        >
          <Lock size={10} />
          Password
        </button>
        <button
          type="button"
          onClick={() => setUseMagic(true)}
          className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
            useMagic
              ? "bg-white/[0.06] text-foreground"
              : "text-foreground-subtle hover:text-foreground"
          }`}
        >
          <Zap size={10} />
          Magic link
        </button>
      </div>

      {/* ── Password form ───────────────────────────────────────────────────── */}
      {!useMagic && (
        <form action={formAction} className="px-6 py-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="security@company.com"
              aria-invalid={!!state.fieldErrors?.email}
            />
            <FieldError>{state.fieldErrors?.email}</FieldError>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/reset-password"
                className="text-[11px] text-foreground-muted hover:text-acid transition-colors"
              >
                Reset
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={1}
              aria-invalid={!!state.fieldErrors?.password}
            />
            <FieldError>{state.fieldErrors?.password}</FieldError>
          </div>

          {state.error && !state.ok ? (
            <div
              role="alert"
              className="rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
            >
              {state.error}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending}
          >
            <Lock size={14} strokeWidth={1.75} />
            {pending ? "Authenticating…" : "Sign in"}
          </Button>
        </form>
      )}

      {/* ── Magic link form ─────────────────────────────────────────────────── */}
      {useMagic && (
        <form action={magicAction} className="px-6 py-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="magic-email">Work email</Label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="security@company.com"
            />
          </div>

          {magicState.error ? (
            <div
              role="alert"
              className={
                magicState.ok
                  ? "rounded-sm border-hairline border-acid/40 bg-acid-wash px-3 py-2 text-xs text-acid"
                  : "rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
              }
            >
              {magicState.error}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={magicPending || magicState.ok}
          >
            <Mail size={14} strokeWidth={1.75} />
            {magicPending ? "Sending…" : magicState.ok ? "Link sent ✓" : "Email me a link"}
          </Button>

          <p className="text-center text-[11px] text-foreground-subtle">
            No password needed — we send a one-time secure link.
          </p>
        </form>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4 flex items-center justify-between text-xs text-foreground-muted">
        <span>No account?</span>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-1 text-foreground hover:text-acid transition-colors"
        >
          Request access <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
