import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import {
  fetchAlmanacFacets,
  fetchPublishedAlmanacEntries,
} from "@/lib/almanac/queries";
import { AlmanacCatalog } from "./almanac-catalog";

export const metadata: Metadata = {
  title: "Vulnerability Almanac — ForgeGuard AI",
  description:
    "A living public catalog of LLM security findings — sanitized, deduplicated, and mapped to OWASP LLM categories.",
};

export const dynamic = "force-dynamic";

export default async function AlmanacPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; family?: string; owasp?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const family = sp.family?.trim() ?? "";
  const owasp = sp.owasp?.trim() ?? "";

  const user = await getSessionUser();
  const isAuthenticated = !!user;
  let destination = "/dashboard";
  if (isAuthenticated) {
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") destination = "/admin";
  }

  const [entries, facets] = await Promise.all([
    fetchPublishedAlmanacEntries({ q, family, owasp, limit: 100 }),
    fetchAlmanacFacets(),
  ]);

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />

      <section className="relative overflow-hidden pt-32 pb-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid-hairline bg-grid-lg opacity-[0.25]"
        />
        <div className="relative mx-auto max-w-5xl px-6 md:px-8">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#D1FF00]">
            {"// resources/almanac"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Vulnerability Almanac
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
            A living book of LLM security findings observed across ForgeGuard red-team
            runs. Entries are redacted, deduplicated by attack family, and curated before
            publication. No customer API keys or raw targets appear here.
          </p>
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-5xl px-6 md:px-8">
          <AlmanacCatalog
            entries={entries}
            families={facets.families}
            owaspIds={facets.owaspIds}
            initialQ={q}
            initialFamily={family}
            initialOwasp={owasp}
          />
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-10">
        <div className="mx-auto max-w-5xl px-6 text-center md:px-8">
          <p className="text-sm text-white/45">
            Methodology aligned with{" "}
            <Link href="/resources/guidelines" className="text-[#D1FF00] hover:underline">
              Red-Teaming Guidelines
            </Link>
            .
          </p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
