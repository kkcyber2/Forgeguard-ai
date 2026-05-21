import * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Store,
  AlertTriangle,
  Tag,
  DollarSign,
  ChevronRight,
  Clock,
  Code2,
} from "lucide-react";
import { requireAdminProfile, createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditVerdict = "pending_audit" | "cleared" | "rejected" | null;

interface BazaarScript {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  tags: string[] | null;
  price_credits: number | null;
  risk_score: number | null;
  audit_verdict: AuditVerdict;
  is_published: boolean;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; email: string | null } | null;
}

async function getPendingScripts(): Promise<BazaarScript[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bazaar_scripts")
    .select(
      `id, name, description, language, tags, price_credits, risk_score,
       audit_verdict, is_published, created_at, author_id,
       profiles:author_id (display_name, email)`,
    )
    .or("audit_verdict.eq.pending_audit,and(is_published.eq.false,audit_verdict.is.null)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/bazaar] fetch error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as BazaarScript[];
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="font-mono text-[10px] text-steel-600">&mdash;</span>;

  const cls =
    score >= 8
      ? "text-threat border-threat/30 bg-threat/5"
      : score >= 5
        ? "text-amber-400 border-amber-400/30 bg-amber-400/5"
        : "text-acid border-acid/30 bg-acid/5";

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-widest",
      cls,
    )}>
      {score >= 8 && <AlertTriangle size={8} />}
      {score.toFixed(1)}
    </span>
  );
}

export default async function AdminBazaarPage() {
  const profile = await requireAdminProfile();
  if (!profile) redirect("/admin");

  const scripts = await getPendingScripts();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Store size={15} className="text-acid" />
          <h1 className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-steel-100">
            BAZAAR TRIAGE
          </h1>
        </div>
        <p className="font-mono text-[11px] text-steel-500">
          Scripts pending audit &mdash; review, verify, or reject before publication.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3">
        <span className="rounded-sm border border-acid/20 bg-acid/5 px-3 py-1 font-mono text-[10px] text-acid">
          {scripts.length} pending
        </span>
        <span className="font-mono text-[10px] text-steel-600">
          Last refreshed: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-steel-900/60 bg-obsidian-900/40 py-16 text-center">
          <Store size={28} className="text-steel-800" />
          <p className="font-mono text-[12px] text-steel-600">No scripts pending audit. The queue is clear.</p>
        </div>
      ) : (
        <div className="rounded-sm border border-steel-900/60 bg-obsidian-900/40">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 border-b border-steel-900/60 px-5 py-2.5">
            {["Script", "Author", "Language", "Price", "Risk", "Action"].map((h) => (
              <span key={h} className="font-mono text-[9px] uppercase tracking-widest text-steel-600">{h}</span>
            ))}
          </div>

          {scripts.map((script, i) => {
            const author =
              script.profiles?.display_name ??
              script.profiles?.email ??
              script.author_id.slice(0, 8);

            return (
              <div
                key={script.id}
                className={cn(
                  "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-5 py-3.5",
                  i < scripts.length - 1 && "border-b border-steel-900/30",
                  "transition-colors hover:bg-obsidian-800/30",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12px] font-semibold text-steel-100">{script.name}</p>
                  {script.description && (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-steel-600">{script.description}</p>
                  )}
                  {script.tags && script.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {script.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-0.5 rounded-sm border border-steel-900/60 bg-obsidian-950 px-1.5 py-0.5 font-mono text-[8px] text-steel-600">
                          <Tag size={7} />{tag}
                        </span>
                      ))}
                      {script.tags.length > 3 && (
                        <span className="font-mono text-[8px] text-steel-700">+{script.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="truncate font-mono text-[11px] text-steel-400">{author}</span>
                <div className="flex items-center gap-1.5">
                  <Code2 size={9} className="shrink-0 text-steel-600" />
                  <span className="font-mono text-[11px] text-steel-400">{script.language ?? "&mdash;"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign size={9} className="text-steel-600" />
                  <span className="font-mono text-[11px] text-steel-400">{script.price_credits ?? 0} cr</span>
                </div>
                <RiskBadge score={script.risk_score} />
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/bazaar/${script.id}`}
                    className="inline-flex items-center gap-1 rounded-sm border border-acid/30 bg-acid/5 px-2.5 py-1 font-mono text-[10px] text-acid transition-colors hover:bg-acid/15"
                  >
                    Review<ChevronRight size={10} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scripts.length > 0 && (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-steel-700">
          <Clock size={10} />
          Oldest pending: {new Date(scripts[scripts.length - 1].created_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
