import * as React from "react";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/badge";

/**
 * Data integrity coverage map — compliance findings ForgeGuard validates.
 * No iconography, because density is the point. Every row should feel like
 * a line item in an audit-ready compliance report.
 */

const rows = [
  { atlas: "AML.T0051", category: "Input integrity", technique: "Indirect injection via retrieved tool output", coverage: "secure" },
  { atlas: "AML.T0048", category: "Input integrity", technique: "Encoded payload normalization (Base64 / rot13)", coverage: "secure" },
  { atlas: "AML.T0054", category: "Compliance boundary", technique: "Persona escalation · role-policy drift", coverage: "secure" },
  { atlas: "AML.T0057", category: "Data integrity", technique: "Markdown-image callback leakage", coverage: "secure" },
  { atlas: "AML.T0043", category: "Data integrity", technique: "Function-calling parameter smuggling", coverage: "partial" },
  { atlas: "AML.T0059", category: "Tool compliance", technique: "Sandboxed code-interpreter boundary checks", coverage: "secure" },
  { atlas: "AML.T0053", category: "Tool compliance", technique: "Cross-agent authority confusion", coverage: "partial" },
  { atlas: "AML.T0046", category: "Model integrity", technique: "Output fingerprinting via structured prompts", coverage: "secure" },
] as const;

const KINETIC_VECTORS = [
  {
    surface: "LLM ENDPOINT",
    badge: "Industry Standard Red-Teaming",
    tone: "secure" as const,
    detail: "Garak + PyRIT prompt hijack, jailbreak mutators, 400+ catalogue probes.",
  },
  {
    surface: "WEB APPLICATION",
    badge: "Beta Probe",
    tone: "warn" as const,
    detail: "Playwright logic discovery, XSS scout, client gateway crawl.",
  },
  {
    surface: "API GATEWAY",
    badge: "Beta Probe",
    tone: "warn" as const,
    detail: "BOLA/IDOR sequential fuzzer, hidden user exfiltration checks.",
  },
  {
    surface: "CHAT BOT",
    badge: "Beta Probe",
    tone: "warn" as const,
    detail: "Intent drift harness, tool-call injection, sales-to-hacker pivot.",
  },
] as const;

export function AttackSurface() {
  return (
    <Section id="data-integrity" className="border-t-[0.5px] border-white/[0.04]">
      <Reveal>
        <SectionHeading
          eyebrow="Data integrity coverage"
          title="Every compliance control your governance already lists. Mapped, validated, logged."
          lede="Coverage is framed against the MITRE ATLAS matrix so compliance officers, researchers, and engineering share a single audit vocabulary."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-sm border-hairline border-white/[0.06]">
          <div className="hidden md:grid grid-cols-[140px_160px_1fr_120px] items-center gap-4 border-b-[0.5px] border-white/[0.06] bg-obsidian-800/60 px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
            <span>ATLAS ID</span>
            <span>Category</span>
            <span>Technique</span>
            <span className="text-right">Coverage</span>
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {rows.map((row) => (
              <li
                key={row.atlas}
                className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr_120px] gap-y-1 md:gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-mono text-xs text-foreground-subtle">{row.atlas}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-foreground-muted">{row.category}</span>
                <span className="text-sm text-foreground">{row.technique}</span>
                <span className="md:text-right">
                  <Badge tone={row.coverage === "secure" ? "secure" : "warn"} dot>
                    {row.coverage === "secure" ? "Blocked" : "Monitor"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t-[0.5px] border-white/[0.06] bg-obsidian-900/40 px-5 py-3 text-xs text-foreground-subtle">
            + 450 high-precision probes covering ATLAS tactics TA0043 → TA0059.{" "}
            <Link href="/auth/signup" className="text-foreground hover:text-acid transition-colors">
              Start a scan
            </Link>{" "}
            to view your full coverage map.
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-sm border-hairline border-white/[0.06]">
          <div className="border-b-[0.5px] border-white/[0.06] bg-obsidian-800/60 px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
            Kinetic attack surfaces
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {KINETIC_VECTORS.map((vector) => (
              <li
                key={vector.surface}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-sm text-foreground">{vector.surface}</p>
                  <p className="mt-1 text-xs text-foreground-subtle">{vector.detail}</p>
                </div>
                <Badge tone={vector.tone} dot>
                  {vector.badge}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Section>
  );
}
