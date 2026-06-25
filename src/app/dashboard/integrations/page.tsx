import Link from "next/link";
import { redirect } from "next/navigation";
import { Code2, KeyRound, Terminal } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { buttonStyles } from "@/components/ui/button";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CURL_EXAMPLE = `curl -s -X POST https://forgeguard-ai.com/api/v1/scans \\
  -H "Authorization: Bearer fg_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"target_model":"gpt-4o","target_url":"https://api.openai.com/v1/chat/completions","api_key":"sk-…","notes":"CI deploy #42"}'`;

export default async function IntegrationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/integrations");

  return (
    <>
      <PageHeader
        eyebrow="Developer"
        title="Integrations"
        description="Embed ForgeGuard red-teaming in CI/CD, webhooks, and custom pipelines."
        actions={
          <Link
            href="/dashboard/settings#api-keys"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            <KeyRound size={14} strokeWidth={1.75} />
            API keys
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-foreground-muted">
            <KeyRound size={14} strokeWidth={1.75} />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
              API keys
            </span>
          </div>
          <p className="text-sm text-foreground-muted">
            Generate a Bearer token in Settings → API keys. Keys are hashed at
            rest and scoped to your tenant scans only.
          </p>
          <Link
            href="/dashboard/settings#api-keys"
            className={buttonStyles({ variant: "secondary", size: "sm", className: "mt-4" })}
          >
            Open API key settings
          </Link>
        </section>

        <section className="rounded-sm border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-foreground-muted">
            <Code2 size={14} strokeWidth={1.75} />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
              CI/CD scan trigger
            </span>
          </div>
          <p className="text-sm text-foreground-muted">
            POST to <code className="text-foreground">/api/v1/scans</code> from
            GitHub Actions, GitLab CI, or any pipeline. Returns a scan ID and
            dashboard URL to poll results.
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-sm border border-border bg-surface-raised p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-foreground-muted">
          <Terminal size={14} strokeWidth={1.75} />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
            Example
          </span>
        </div>
        <pre className="overflow-x-auto rounded-sm border border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-foreground-muted">
          {CURL_EXAMPLE}
        </pre>
      </section>
    </>
  );
}
