import * as React from "react";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Terms of Service — ForgeGuard AI",
  description:
    "ForgeGuard AI Terms of Service. Governs all use of the platform including red-teaming tools, bounty programs, and Aegis runtime guardrails.",
};

const LAST_UPDATED = "May 15, 2025";

export default async function TermsPage() {
  const user = await getSessionUser();
  const isAuthenticated = !!user;
  let destination = "/dashboard";
  if (isAuthenticated) {
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") destination = "/admin";
  }

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />

      <div className="mx-auto max-w-3xl px-6 pt-32 pb-24 md:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid mb-4">
          // legal/terms
        </p>
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-foreground-muted mb-12">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-foreground-muted">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using ForgeGuard AI ("Platform", "Service", "we",
              "us") you agree to be bound by these Terms of Service and all
              applicable laws and regulations. If you do not agree, you may not
              access the Platform.
            </p>
            <p>
              These Terms apply to all users including Clients (access level 1),
              Hackers (access level 2), and Developers (access level 3) as
              defined in the Platform's identity framework.
            </p>
          </Section>

          <Section title="2. Platform Description">
            <p>
              ForgeGuard AI provides adversarial red-teaming, runtime guardrails
              (Aegis), and security research tooling for AI and LLM deployments.
              The Platform includes:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>Automated scan and attack-chain generation against user-submitted AI endpoints</Bullet>
              <Bullet>The Forge: a sandboxed adversarial script execution environment</Bullet>
              <Bullet>Aegis: runtime WAF and guardrail rule generation and export</Bullet>
              <Bullet>Bounty program infrastructure for structured vulnerability disclosure</Bullet>
              <Bullet>Bazaar: a marketplace for approved security research scripts</Bullet>
              <Bullet>Mission Vault: structured red-team operation coordination</Bullet>
            </ul>
          </Section>

          <Section title="3. Authorized Use">
            <p>
              You may only use the Platform for lawful security research,
              authorized penetration testing, and defensive security purposes.
              Specifically:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>You may scan AI systems you own or have explicit written authorization to test</Bullet>
              <Bullet>You may submit vulnerability reports through the Bounty program only for targets with active bounty scopes</Bullet>
              <Bullet>You may execute scripts in The Forge only against systems you are authorized to test</Bullet>
            </ul>
            <p className="mt-4">
              You may NOT use the Platform to conduct unauthorized access,
              denial-of-service attacks, data theft, or any activity that
              violates applicable law including the Computer Fraud and Abuse Act
              (CFAA), the UK Computer Misuse Act, or equivalent legislation in
              your jurisdiction.
            </p>
          </Section>

          <Section title="4. Security Research Policy">
            <p>
              ForgeGuard AI supports responsible security research. When
              conducting research through our Platform:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>You must not exceed the scope defined in the active bounty or scan target</Bullet>
              <Bullet>You must not access, exfiltrate, or retain user data beyond what is necessary to document the vulnerability</Bullet>
              <Bullet>You must report all findings through the Platform's official submission channels</Bullet>
              <Bullet>You must comply with our 90-day responsible disclosure timeline</Bullet>
              <Bullet>You must not publicly disclose vulnerability details before remediation is confirmed</Bullet>
            </ul>
            <p className="mt-4">
              Violations of this policy may result in immediate account
              termination, forfeiture of earned rewards, and referral to law
              enforcement.
            </p>
          </Section>

          <Section title="5. Scan Targets and Authorization">
            <p>
              When submitting a scan target, you represent and warrant that you
              are authorized to conduct security testing against that target. By
              submitting a domain or endpoint, you certify that:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>You own the domain/system, or have documented written authorization from the owner</Bullet>
              <Bullet>The target is not critical infrastructure, healthcare systems, or financial systems outside your control</Bullet>
              <Bullet>You will not use scan results to conduct offensive operations beyond the authorized scope</Bullet>
            </ul>
            <p className="mt-4">
              ForgeGuard AI reserves the right to suspend scans, block targets,
              and terminate accounts where abuse is detected or suspected.
            </p>
          </Section>

          <Section title="6. Bounty Program Rules">
            <p>
              The ForgeGuard AI Bounty Program operates under the following rules:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>Rewards are issued based on CVSS 4.0 severity scores assigned by our triage engine</Bullet>
              <Bullet>Duplicate reports (same vulnerability, previously submitted) are not eligible for reward</Bullet>
              <Bullet>Self-inflicted vulnerabilities (you created the vulnerability to report it) are ineligible</Bullet>
              <Bullet>Reports must include a working reproduction chain — CVSS score, payload, affected endpoint, and impact statement</Bullet>
              <Bullet>Rewards are paid via Payoneer or Wise upon vulnerability remediation confirmation</Bullet>
              <Bullet>ForgeGuard AI is the final arbiter of eligibility and reward amounts</Bullet>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              All Platform code, architecture, algorithms, attack taxonomies,
              rule libraries, and tooling remain the exclusive intellectual
              property of ForgeGuard AI. You retain ownership of:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>Vulnerability reports you submit through the Bounty program</Bullet>
              <Bullet>Custom scripts you publish on the Bazaar (subject to Platform license)</Bullet>
              <Bullet>Scan results generated for your own authorized targets</Bullet>
            </ul>
            <p className="mt-4">
              By submitting content to the Bazaar, you grant ForgeGuard AI a
              non-exclusive, royalty-free license to display, distribute, and
              monetize that content through the Platform.
            </p>
          </Section>

          <Section title="8. Privacy and Data Handling">
            <p>
              Your use of the Platform is subject to our{" "}
              <a href="/legal/privacy" className="text-acid hover:underline">
                Privacy Policy
              </a>
              . Key data handling principles:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <Bullet>Scan payloads are encrypted at rest and isolated per tenant</Bullet>
              <Bullet>We do not sell or share your vulnerability data with third parties</Bullet>
              <Bullet>API keys are never stored client-side — all AI calls route through our proxy layer</Bullet>
              <Bullet>You may request deletion of your account and associated data at any time</Bullet>
            </ul>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORGEGUARD AI IS NOT
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL
              DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING BUT NOT
              LIMITED TO LOSS OF DATA, PROFITS, OR GOODWILL.
            </p>
            <p className="mt-4">
              ForgeGuard AI does not guarantee that scan results are complete,
              accurate, or that they identify all vulnerabilities in a target
              system. Security assessments are advisory in nature.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We may suspend or terminate your access immediately, without
              notice, if we believe you have violated these Terms or if your
              continued use poses a risk to the Platform or other users.
            </p>
            <p className="mt-4">
              Upon termination, your right to access the Platform ceases
              immediately. Data retention after termination is governed by our
              Privacy Policy.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              We may update these Terms at any time. We will notify registered
              users of material changes via email. Continued use of the Platform
              after notification constitutes acceptance of updated Terms.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about these Terms should be directed to{" "}
              <a href="mailto:legal@forgeguard.ai" className="text-acid hover:underline">
                legal@forgeguard.ai
              </a>
              .
            </p>
          </Section>
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 font-semibold text-foreground text-base border-b border-white/[0.06] pb-2">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-foreground-muted">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-acid/50" />
      {children}
    </li>
  );
}
