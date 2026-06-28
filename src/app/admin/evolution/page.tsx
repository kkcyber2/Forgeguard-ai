import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Dna,
  Brain,
  ShieldCheck,
  Boxes,
  TrendingDown,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchEvolveStats, type EvolveStats } from "@/lib/evolution/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "Evolution · Admin" };

export default async function EvolutionAdminPage() {
  const supabase = await createServerSupabase();

  const [stats, approvedToolsResp] = await Promise.all([
    fetchEvolveStats(),
    supabase
      .from("custom_attack_tools")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);
  const approvedTools = approvedToolsResp?.count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Self-Evolution"
        title="Evolution telemetry"
        description="Live proof that the engine is learning from every scan — attack lessons, live Aegis closed-loop, plugin discovery, and the developer arsenal."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Plugins discovered"
            value={stats?.metrics.plugin_discovery_count ?? "—"}
            tone="secure"
            icon={Boxes}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                auto-discovered catalogue
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Lessons persisted"
            value={stats?.metrics.lessons_persisted ?? "—"}
            tone="neutral"
            icon={Brain}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {stats?.metrics.lessons_loaded ?? 0} loaded into scans
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Closed-loop block rate"
            value={
              stats ? `${stats.metrics.closed_loop_block_rate}%` : "—"
            }
            tone={
              stats && stats.metrics.closed_loop_block_rate >= 50
                ? "secure"
                : "neutral"
            }
            icon={ShieldCheck}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {stats?.metrics.closed_loop_blocks ?? 0} /{" "}
                {stats?.metrics.closed_loop_attempts ?? 0} breaches proven
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Breaches after lesson"
            value={stats?.metrics.breaches_after_lesson ?? "—"}
            tone={
              stats && stats.metrics.breaches_after_lesson > 0
                ? "threat"
                : "secure"
            }
            icon={TrendingDown}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                lower over time = evolving
              </span>
            }
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Engine reachability */}
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Dna size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Engine status</p>
            <Badge
              tone={stats ? "secure" : "warn"}
              className="ml-auto"
            >
              {stats ? "Telemetry live" : "Engine unreachable"}
            </Badge>
          </div>
          <p className="text-sm text-foreground-subtle">
            {stats
              ? "Agathon /evolve/stats responded. Counters reflect the current engine process."
              : "Set PYTHON_ENGINE_URL + INTERNAL_SCAN_TOKEN on Vercel so the admin can read /evolve/stats from the engine."}
          </p>
        </div>

        {/* Developer arsenal */}
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Zap size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Developer arsenal</p>
            <Badge tone={approvedTools ? "secure" : "neutral"} className="ml-auto">
              {approvedTools ?? 0} approved
            </Badge>
          </div>
          <p className="text-sm text-foreground-subtle">
            Operator-authored attack tools in <code className="font-mono">custom_attack_tools</code>{" "}
            that passed the audit pipeline and are runnable by the Brain via{" "}
            <code className="font-mono">run_operator_tool</code>.
          </p>
        </div>
      </div>

      {/* Top breached families + surface breakdown */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Brain size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Top families breached (cross-scan ledger)</p>
          </div>
          <FamilyTable stats={stats} />
        </div>

        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Boxes size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Breaches by surface</p>
          </div>
          <SurfaceTable stats={stats} />
        </div>
      </div>
    </>
  );
}

function FamilyTable({ stats }: { stats: EvolveStats | null }) {
  const rows = stats?.top_families_breached ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        No breached families yet — the attack_lessons ledger is empty.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          <tr>
            <th className="py-2 pr-4">Family</th>
            <th className="py-2 pr-4">Breaches</th>
            <th className="py-2">Failures</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/[0.04]">
              <td className="py-2 pr-4">{r.family ?? "—"}</td>
              <td className="py-2 pr-4 text-acid">{r.breach_count}</td>
              <td className="py-2 text-foreground-subtle">{r.fail_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SurfaceTable({ stats }: { stats: EvolveStats | null }) {
  const entries = Object.entries(stats?.metrics.attacks_run_by_surface ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        No breaches recorded yet this process.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          <tr>
            <th className="py-2 pr-4">Surface</th>
            <th className="py-2">Breaches</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {entries.map(([surface, n]) => (
            <tr key={surface} className="border-t border-white/[0.04]">
              <td className="py-2 pr-4 uppercase">{surface}</td>
              <td className="py-2 text-acid">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
