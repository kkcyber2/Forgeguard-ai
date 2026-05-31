"use client";

import * as React from "react";
import Link from "next/link";

type Props = {
  /** When true, banner is hidden. */
  consented: boolean;
};

/**
 * Essential-only cookie consent. Logs acceptance via API (profiles + guest cookie).
 */
export function CookieConsentBanner({ consented: initialConsented }: Props) {
  const [consented, setConsented] = React.useState(initialConsented);
  const [pending, setPending] = React.useState(false);

  if (consented) return null;

  async function accept() {
    setPending(true);
    try {
      const res = await fetch("/api/compliance/cookie-consent", { method: "POST" });
      if (res.ok) setConsented(true);
    } finally {
      setPending(false);
    }
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
          onClick={() => void accept()}
          className="shrink-0 rounded-sm border border-acid/40 bg-acid/10 px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-acid transition-colors hover:bg-acid/20 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Accept essential cookies"}
        </button>
      </div>
    </div>
  );
}
