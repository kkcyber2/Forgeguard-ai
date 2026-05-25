import Link from "next/link";
import { ShieldCheck, Store, ChevronRight, Code2, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verified Bazaar" };

interface VerifiedScript {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  price_usd: number | null;
  purchase_count: number | null;
  audit_risk_score: number | null;
  created_at: string;
}

export default async function BazaarVerifiedPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bazaar_scripts")
    .select(
      "id, name, description, language, price_usd, purchase_count, audit_risk_score, created_at",
    )
    .eq("is_certified", true)
    .eq("audit_verdict", "cleared")
    .eq("is_published", true)
    .eq("is_removed", false)
    .order("purchase_count", { ascending: false })
    .limit(100);

  if (error) console.error("[bazaar/verified]", error.message);
  const scripts = (data ?? []) as VerifiedScript[];

  return (
    <>
      <PageHeader
        eyebrow="Operations · Bazaar"
        title="Verified scripts"
        description="Sovereign-certified, cleared, and published operator tooling."
        actions={
          <Link
            href="/dashboard/bazaar"
            className="inline-flex items-center gap-1.5 rounded-sm border-[0.5px] border-white/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground-muted hover:text-foreground"
          >
            <Store size={12} />
            Full bazaar
          </Link>
        }
      />

      {scripts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No verified scripts yet"
          description="Certified scripts appear here after admin clearance."
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scripts.map((s) => (
            <StaggerItem key={s.id}>
              <article
                className="rounded-sm border-[0.5px] border-acid/20 p-4"
                style={{ background: "#050505" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm text-foreground">{s.name}</span>
                  <span className="rounded-[3px] border-[0.5px] border-acid/30 bg-acid/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
                    Certified
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-foreground-muted">
                  {s.description ?? "No description."}
                </p>
                <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-foreground-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Code2 size={10} />
                    {s.language ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign size={10} />
                    {s.price_usd != null && s.price_usd > 0
                      ? `$${Number(s.price_usd).toFixed(2)}`
                      : "Free"}
                  </span>
                  <span>{s.purchase_count ?? 0} installs</span>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
