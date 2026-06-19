import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Database, Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { buttonStyles } from "@/components/ui/button";
import { fetchTrainingCorpusStats } from "./actions";
import { TrainingCorpusExportPanel } from "./export-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training Corpus" };

export default async function TrainingCorpusAdminPage() {
  const stats = await fetchTrainingCorpusStats();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Training Corpus"
        description="Redacted scan findings for future model training — admin export only. Users may opt out in Settings."
      />

      <Link href="/admin" className={buttonStyles({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Command Center
      </Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total events" value={stats.eventCount} />
        <StatCard label="Exportable" value={stats.exportableCount} />
        <StatCard
          label="Last event"
          value={stats.lastEventAt ? new Date(stats.lastEventAt).toLocaleString() : "—"}
        />
      </div>

      <TrainingCorpusExportPanel lastExportPath={stats.lastExportPath} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl text-lime-400">{value}</p>
    </div>
  );
}
