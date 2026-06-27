import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { fetchPublishedAlmanacBySlug } from "@/lib/almanac/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await fetchPublishedAlmanacBySlug(slug);
  if (!entry) return { title: "Almanac entry" };
  return {
    title: `${entry.title} — Vulnerability Almanac`,
    description: entry.summary_md.slice(0, 160),
  };
}

export default async function AlmanacEntryPage({ params }: Props) {
  const { slug } = await params;
  const entry = await fetchPublishedAlmanacBySlug(slug);
  if (!entry) notFound();

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

      <article className="mx-auto max-w-3xl px-6 pb-20 pt-32 md:px-8">
        <Link
          href="/resources/almanac"
          className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70"
        >
          <ArrowLeft size={14} />
          Almanac
        </Link>

        <div className="mb-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className="rounded border border-white/15 px-2 py-0.5 text-white/55">
            {entry.severity}
          </span>
          {entry.cvss_v3_score != null ? (
            <span className="rounded border border-amber-400/30 px-2 py-0.5 text-amber-300/80">
              CVSS {entry.cvss_v3_score.toFixed(1)}
              {entry.cvss_severity ? ` · ${entry.cvss_severity}` : ""}
            </span>
          ) : null}
          {entry.epss_percentile != null ? (
            <span
              className={
                "rounded border px-2 py-0.5 " +
                (entry.epss_percentile >= 0.8
                  ? "border-red-400/30 text-red-300/80"
                  : entry.epss_percentile >= 0.4
                    ? "border-amber-400/30 text-amber-300/80"
                    : "border-white/15 text-white/55")
              }
              title="EPSS exploit-likelihood percentile (higher = more likely exploited in the wild)"
            >
              EPSS {(entry.epss_percentile * 100).toFixed(1)}%
            </span>
          ) : null}
          {entry.owasp_id ? (
            <span className="rounded border border-[#D1FF00]/25 px-2 py-0.5 text-[#D1FF00]/80">
              {entry.owasp_id}
            </span>
          ) : null}
          <span className="text-white/35">{entry.family}</span>
          {entry.source_type === "cve" || entry.source_type === "nvd" ? (
            <span className="text-violet-300/80">
              External CVE · not scan telemetry
            </span>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold text-white">{entry.title}</h1>
        <p className="mt-2 font-mono text-[10px] text-white/35">
          First seen {new Date(entry.first_seen_at).toLocaleDateString()} · Last seen{" "}
          {new Date(entry.last_seen_at).toLocaleDateString()}
          {entry.cve_id ? ` · ${entry.cve_id}` : ""}
        </p>

        <div className="prose prose-invert mt-8 max-w-none">
          <section className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-6">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Summary
            </h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
              {entry.summary_md}
            </div>
          </section>

          {entry.poc_redacted ? (
            <section className="mt-6 rounded-sm border border-white/[0.08] bg-black/30 p-6">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Redacted proof pattern
              </h2>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#D1FF00]/80">
                {entry.poc_redacted}
              </pre>
              <p className="mt-3 font-mono text-[9px] text-white/30">
                Secrets and API keys are stripped before publication.
              </p>
            </section>
          ) : null}
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}
