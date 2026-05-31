import * as React from "react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";

export type LegalDocumentShellProps = {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

/** Shared marketing shell for /privacy and /terms. */
export async function LegalDocumentShell({
  eyebrow,
  title,
  lastUpdated,
  children,
}: LegalDocumentShellProps) {
  const user = await getSessionUser();
  const isAuthenticated = !!user;
  let destination = "/dashboard";
  if (isAuthenticated) {
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") destination = "/admin";
  }

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />

      <div className="mx-auto max-w-3xl px-6 pt-32 pb-24 md:px-8">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-acid">
          {eyebrow}
        </p>
        <h1 className="mb-2 font-mono text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mb-12 font-mono text-sm text-foreground-muted">
          Last updated: {lastUpdated}
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-foreground-muted">
          {children}
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
