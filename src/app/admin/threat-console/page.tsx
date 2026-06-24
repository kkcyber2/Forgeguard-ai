import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { buttonStyles } from "@/components/ui/button";
import {
  fetchActiveBlocklist,
  fetchPerimeterEvents,
  fetchThreatConsoleStats,
} from "./actions";
import { ThreatConsolePanel } from "./threat-console-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Threat Console" };

export default async function ThreatConsolePage() {
  const [stats, events, blocks] = await Promise.all([
    fetchThreatConsoleStats(),
    fetchPerimeterEvents(),
    fetchActiveBlocklist(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Fortress"
        title="Threat Console"
        description="Legal perimeter defense — hashed IP blocks, honeypot hits, and GeoIP-tagged events. No offensive payloads."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Events / 24h" value={stats.events24h} />
        <Stat label="Critical / 24h" value={stats.critical24h} />
        <Stat label="Active blocks" value={stats.activeBlocks} />
        <Stat label="Honeypots / 24h" value={stats.honeypots24h} />
      </div>

      <div className="flex items-center gap-2 text-xs text-white/40">
        <ShieldAlert size={14} />
        Policy documented in repo:{" "}
        <span className="font-mono text-white/50">CITADEL_LAUNCH_VAULT/LEGAL_DEFENSE_POLICY.md</span>
        {" · "}
        <Link href="/admin/threats" className="text-[#D1FF00] hover:underline">
          Live map
        </Link>
      </div>

      <ThreatConsolePanel events={events} blocks={blocks} />
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
