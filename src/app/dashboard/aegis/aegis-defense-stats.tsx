import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { Shield, ShieldAlert, Radar, Zap } from "lucide-react";

export async function AegisDefenseStats() {
  let blockedCount = 0;
  let scanRules = 0;
  let highFindings = 0;

  try {
    const admin = createAdminSupabase();
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ count: attackCount }, { data: scans }] = await Promise.all([
      admin
        .from("attack_logs")
        .select("id", { count: "exact", head: true })
        .gte("blocked_at", since24),
      admin
        .from("scans")
        .select("finding_count, high_severity_count")
        .eq("status", "completed")
        .gte("created_at", since24)
        .limit(500),
    ]);

    blockedCount = attackCount ?? 0;
    scanRules = (scans ?? []).reduce((a, s) => a + (s.finding_count ?? 0), 0);
    highFindings = (scans ?? []).filter((s) => (s.high_severity_count ?? 0) > 0).length;
  } catch {
    const supabase = await createServerSupabase();
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: scans } = await supabase
      .from("scans")
      .select("finding_count, high_severity_count")
      .eq("status", "completed")
      .gte("created_at", since24)
      .limit(500);
    scanRules = (scans ?? []).reduce((a, s) => a + (s.finding_count ?? 0), 0);
    highFindings = (scans ?? []).filter((s) => (s.high_severity_count ?? 0) > 0).length;
  }

  return (
    <section className="mb-8">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-subtle">
        Aegis defense telemetry — 24h
      </p>
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Blocked requests"
            value={blockedCount}
            tone="threat"
            icon={ShieldAlert}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Exportable rules"
            value={scanRules}
            tone="secure"
            icon={Shield}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="High-risk scans"
            value={highFindings}
            tone="secure"
            icon={Radar}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="WAF targets" value={3} tone="neutral" icon={Zap} />
        </StaggerItem>
      </Stagger>
    </section>
  );
}
