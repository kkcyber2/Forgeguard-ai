import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { buttonStyles } from "@/components/ui/button";
import { AlmanacAdminPanel } from "./almanac-admin-panel";
import { fetchAlmanacAdminEntries, fetchAlmanacAdminStats } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vulnerability Almanac" };

export default async function AlmanacAdminPage() {
  const [stats, entries] = await Promise.all([
    fetchAlmanacAdminStats(),
    fetchAlmanacAdminEntries(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vulnerability Almanac"
        description="Curate sanitized LLM security findings for the public living book. No API keys or raw customer targets in published entries."
      />

      <Link href="/admin" className={buttonStyles({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Command Center
      </Link>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total entries" value={stats.total} />
        <Stat label="Published" value={stats.published} />
        <Stat label="Draft" value={stats.draft} />
        <Stat label="CVE-sourced" value={stats.cve} />
      </div>

      <div className="flex items-center gap-2 text-xs text-white/40">
        <BookOpen size={14} />
        Public catalog:{" "}
        <Link href="/resources/almanac" className="text-[#D1FF00] hover:underline">
          /resources/almanac
        </Link>
      </div>

      <AlmanacAdminPanel entries={entries} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-2 font-mono text-2xl text-lime-400">{value}</p>
    </div>
  );
}
