import * as React from "react";
import {
  Crosshair,
  ShieldCheck,
  Activity,
  Terminal,
  Layers,
  Radar,
} from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";

const features = [
  {
    icon: Crosshair,
    title: "Continuous red-teaming",
    body:
      "600+ adversarial probes — prompt injection, jailbreak, data exfil, tool abuse — fired on every deploy, not once a quarter.",
  },
  {
    icon: ShieldCheck,
    title: "Runtime guardrails",
    body:
      "Deterministic and model-based policies evaluated in < 80ms. Drop the SDK in front of your provider; no router rewrites.",
  },
  {
    icon: Radar,
    title: "Behavioral telemetry",
    body:
      "Every request is diffed against a learned baseline. Anomalies surface in the command-center in near real-time.",
  },
  {
    icon: Activity,
    title: "MITRE ATLAS coverage",
    body:
      "Probes mapped to ATLAS tactics — you see exactly which adversarial ML techniques your stack actually resists.",
  },
  {
    icon: Terminal,
    title: "Agent-aware testing",
    body:
      "First-class support for tool-calling agents: sandboxed exec, multi-hop chains, model-hopping — we test the full graph.",
  },
  {
    icon: Layers,
    title: "Policy as code",
    body:
      "Guardrails live in your repo as versioned YAML. Your security team reviews them in the same PR your engineers ship.",
  },
];

export function FeatureGrid() {
  return (
    <Section id="platform" className="border-t-[0.5px] border-white/[0.04]">
      <Reveal>
        <SectionHeading
          eyebrow="Platform"
          title={
            <>
              The offensive + defensive loop,
              <br className="hidden md:block" /> in one control plane.
            </>
          }
          lede="Most teams bolt on a red-team consultancy once a year and hope for the best. ForgeGuard runs the attacks continuously and wires the findings straight into the policy engine guarding production."
        />
      </Reveal>

      <StaggerGroup className="mt-14 grid grid-cols-1 gap-px bg-white/[0.04] rounded-sm overflow-hidden border-hairline border-white/[0.06] md:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <StaggerItem
            key={title}
            className="group relative bg-surface p-7 transition-colors hover:bg-obsidian-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm border-hairline border-white/10 bg-obsidian-800 transition-colors group-hover:border-acid/40 group-hover:text-acid">
                <Icon size={14} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-medium tracking-tight text-foreground">
                {title}
              </h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
              {body}
            </p>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </Section>
  );
}
