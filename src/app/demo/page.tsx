import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { DemoTerminal } from "@/components/demo/terminal";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section";
import { GridBackground } from "@/components/ui/grid-background";

export const metadata: Metadata = {
  title: "Live Attack Demo",
  description:
    "Watch a scripted prompt injection attack attempt — and ForgeGuard's runtime guardrails deny it in real time.",
};

export default function DemoPage() {
  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated: false, destination: "/dashboard" }} />

      <section className="relative pt-32 pb-8">
        <GridBackground variant="hero" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Live probe"
              title={
                <>
                  An injection attempt —<br />
                  caught, logged, denied.
                </>
              }
              lede="A scripted adversarial sequence against a simulated support agent. The same probes, the same policy engine your production traffic will see."
            />
          </Reveal>
        </div>
      </section>

      <Section className="pt-6">
        <Reveal delay={0.05}>
          <DemoTerminal />
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Legend tone="user" title="USER / TOOL" body="Benign traffic originating from the client or an agent tool-call." />
          <Legend tone="attack" title="INJECTION" body="An adversarial payload smuggled into the context — here, metadata hidden inside a PDF." />
          <Legend tone="secure" title="GUARD" body="Policy evaluation and verdict. The guardrails run before the model response is released." />
        </div>
      </Section>

      <MarketingFooter />
    </main>
  );
}

function Legend({
  tone,
  title,
  body,
}: {
  tone: "user" | "attack" | "secure";
  title: string;
  body: string;
}) {
  const accent =
    tone === "user"
      ? "text-accent-soft"
      : tone === "attack"
      ? "text-threat"
      : "text-acid";
  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <p className={`text-eyebrow ${accent}`}>{title}</p>
      <p className="mt-3 text-sm text-foreground-muted">{body}</p>
    </div>
  );
}
