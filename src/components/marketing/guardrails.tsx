import * as React from "react";
import { Section, SectionHeading } from "@/components/ui/section";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/**
 * Guardrails section — a single stylized code block (policy.yaml) paired
 * with bullet annotations. No mock 3D; the type is the hero.
 */

const yaml = `guardrails:
  - id: pii.block
    phase: output
    rules:
      - match: regex(/\\b\\d{3}-\\d{2}-\\d{4}\\b/)   # US SSN
        action: redact
      - match: classifier("pii.sensitive") > 0.8
        action: block

  - id: jailbreak.intent
    phase: input
    rules:
      - match: classifier("jailbreak") > 0.72
        action: deny
        audit:
          severity: high
          channel: sec-alerts

  - id: tool.allowlist
    phase: tool_call
    rules:
      - match: tool.name not in \${approved_tools}
        action: block
        error: "tool \${tool.name} is outside the production allowlist"
`;

export function Guardrails() {
  return (
    <Section id="guardrails" className="border-t-[0.5px] border-white/[0.04]">
      <Reveal>
        <SectionHeading
          eyebrow="Policy as code"
          title="Guardrails you ship like any other artifact."
          lede="Declarative YAML, reviewed in the same pull request as the feature. Your security team doesn't click through a console — they approve a diff."
        />
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <Reveal delay={0.05} className="lg:col-span-7">
          <figure className="relative overflow-hidden rounded-sm border-hairline border-white/[0.08] bg-obsidian-900/80">
            <figcaption className="flex h-9 items-center justify-between border-b-[0.5px] border-white/[0.06] px-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-subtle">
                policy.forgeguard.yaml
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                <span className="h-1.5 w-1.5 rounded-full bg-acid animate-pulse-acid" />
              </span>
            </figcaption>
            <pre className="scanlines px-5 py-5 overflow-x-auto">
              <code className="font-mono text-[12.5px] leading-relaxed text-foreground/90">
                <Highlighted yaml={yaml} />
              </code>
            </pre>
          </figure>
        </Reveal>

        <StaggerGroup className="lg:col-span-5 space-y-5">
          {[
            {
              k: "Versioned",
              v: "Every policy change is a git commit. Audit log is free.",
            },
            {
              k: "Composable",
              v: "Reuse policy fragments across agents, tenants, environments.",
            },
            {
              k: "Typed",
              v: "Policy files are validated at CI time. Typos fail the build, not your production agent.",
            },
            {
              k: "Enforced",
              v: "Policies run as a sidecar or WASM runtime — no traffic is ever in the clear.",
            },
          ].map((pt) => (
            <StaggerItem key={pt.k}>
              <div className="flex gap-5 border-t-[0.5px] border-white/[0.06] pt-5 first:border-0 first:pt-0">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-acid w-24 shrink-0">
                  {pt.k}
                </span>
                <p className="text-sm text-foreground-muted">{pt.v}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}

/** Lightweight, dependency-free YAML highlighter for the policy block. */
function Highlighted({ yaml }: { yaml: string }) {
  const lines = yaml.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {colorize(line)}
        </span>
      ))}
    </>
  );
}

function colorize(line: string): React.ReactNode {
  // comment
  const commentIdx = line.indexOf("#");
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : "";

  // key: value
  const m = codePart.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)$/);
  if (m) {
    return (
      <>
        {m[1]}
        <span className="text-accent-soft">{m[2]}</span>
        <span className="text-foreground-subtle">{m[3]}</span>
        {colorizeValue(m[4])}
        <span className="text-foreground-subtle/70">{commentPart}</span>
      </>
    );
  }
  // list marker
  const li = codePart.match(/^(\s*-\s*)(.*)$/);
  if (li) {
    return (
      <>
        <span className="text-foreground-subtle">{li[1]}</span>
        {colorizeValue(li[2])}
        <span className="text-foreground-subtle/70">{commentPart}</span>
      </>
    );
  }
  return (
    <>
      {codePart}
      <span className="text-foreground-subtle/70">{commentPart}</span>
    </>
  );
}

function colorizeValue(v: string): React.ReactNode {
  if (!v) return null;
  // "string"
  if (/^".*"$/.test(v)) return <span className="text-acid/80">{v}</span>;
  // number
  if (/^-?\d+(\.\d+)?$/.test(v)) return <span className="text-accent-soft">{v}</span>;
  // known keywords
  if (/(block|deny|redact|allow)/.test(v)) {
    return v.split(/(block|deny|redact|allow)/g).map((t, i) =>
      /(block|deny|redact|allow)/.test(t) ? (
        <span
          key={i}
          className={cn(
            t === "allow" || t === "redact" ? "text-acid" : "text-threat",
          )}
        >
          {t}
        </span>
      ) : (
        <span key={i} className="text-foreground">
          {t}
        </span>
      ),
    );
  }
  return <span className="text-foreground">{v}</span>;
}
