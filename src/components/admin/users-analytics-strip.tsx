import { Sparkline } from "@/components/dashboard/sparkline";
import { SeverityMeter } from "@/components/dashboard/severity-meter";
import { StatTile } from "@/components/ui/stat-tile";
import { ShieldCheck, ShieldAlert, Users } from "lucide-react";

export interface UsersAnalyticsData {
  signupTrend: number[];
  roleCounts: { admin: number; user: number; other: number };
  verifiedCount: number;
  unverifiedCount: number;
  pendingVerification: number;
}

export function UsersAnalyticsStrip({ data }: { data: UsersAnalyticsData }) {
  const roleTotal =
    data.roleCounts.admin + data.roleCounts.user + data.roleCounts.other || 1;

  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-3">
      <div
        className="rounded-sm border-[0.5px] border-white/[0.08] p-5 lg:col-span-2"
        style={{ background: "#050505" }}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          Signup trend — 30 days
        </p>
        <Sparkline
          data={data.signupTrend}
          width={480}
          height={56}
          stroke="acid"
          ariaLabel="User signup trend"
        />
      </div>

      <div
        className="space-y-3 rounded-sm border-[0.5px] border-white/[0.08] p-5"
        style={{ background: "#050505" }}
      >
        <StatTile label="Verified" value={data.verifiedCount} tone="secure" icon={ShieldCheck} />
        <StatTile label="Unverified" value={data.unverifiedCount} tone="neutral" icon={Users} />
        <StatTile
          label="Admins"
          value={data.roleCounts.admin}
          tone="threat"
          icon={ShieldAlert}
        />
      </div>

      <div
        className="rounded-sm border-[0.5px] border-white/[0.08] p-5 lg:col-span-3"
        style={{ background: "#050505" }}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          Role distribution
        </p>
        <SeverityMeter
          counts={{
            critical: data.roleCounts.admin,
            high: data.roleCounts.user,
            medium: data.roleCounts.other,
            low: data.verifiedCount,
            info: data.unverifiedCount,
          }}
          showLegend
        />
        <p className="mt-2 font-mono text-[10px] text-foreground-subtle">
          {Math.round((data.roleCounts.admin / roleTotal) * 100)}% admin ·{" "}
          {Math.round((data.roleCounts.user / roleTotal) * 100)}% standard operators
        </p>
      </div>
    </div>
  );
}
