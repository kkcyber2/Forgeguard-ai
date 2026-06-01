"use client";

import * as React from "react";
import Link from "next/link";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_VERSION,
} from "@/services/compliance.service";

const LS_KEY = COOKIE_CONSENT_COOKIE;

function readLocalConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEY) === COOKIE_CONSENT_VERSION;
}

export type CookieConsentProps = {
  /** Server-side hint (profile cookie or httpOnly cookie). */
  initialConsented?: boolean;
};

/**
 * Essential-only cookie consent — optimistic dismiss + localStorage backup.
 */
export function CookieConsent({ initialConsented = false }: CookieConsentProps) {
  const [mounted, setMounted] = React.useState(false);
  const [hasAccepted, setHasAccepted] = React.useState(initialConsented);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (initialConsented || readLocalConsent()) {
      setHasAccepted(true);
    }
  }, [initialConsented]);

  if (hasAccepted) return null;
  if (!mounted && initialConsented) return null;

  function dismissOptimistic() {
    setHasAccepted(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, COOKIE_CONSENT_VERSION);
    }
  }

  async function persistConsent() {
    setPending(true);
    try {
      const res = await fetch("/api/compliance/cookie-consent", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        console.warn("[cookie-consent] API returned", res.status);
      }
    } catch (err) {
      console.warn("[cookie-consent] persist failed:", err);
    } finally {
      setPending(false);
    }
  }

  function handleAccept() {
    dismissOptimistic();
    void persistConsent();
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-white/[0.08] bg-obsidian-950/95 px-4 py-4 backdrop-blur-md md:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-xs leading-relaxed text-foreground-muted md:max-w-2xl">
          We use essential cookies for authentication and theme preference only.
          No advertising or third-party analytics. See our{" "}
          <Link href="/privacy" className="text-acid hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={handleAccept}
          className="shrink-0 rounded-sm border border-acid/40 bg-acid/10 px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-acid transition-colors hover:bg-acid/20 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Accept essential cookies"}
        </button>
      </div>
    </div>
  );
}
