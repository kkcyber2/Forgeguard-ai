import * as React from "react";
import { LegalSection, LegalBullet } from "@/components/legal/legal-section";

export function TermsContent() {
  return (
    <>
      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing ForgeGuard AI you agree to these Terms. If you do not agree,
          you may not use the Platform.
        </p>
      </LegalSection>

      <LegalSection title="2. Platform Description">
        <p>
          ForgeGuard AI provides adversarial red-teaming, runtime guardrails (Aegis),
          The Forge, Bounty infrastructure, Bazaar, and Mission Vault tooling.
        </p>
      </LegalSection>

      <LegalSection title="3. Authorized Use">
        <p>
          Use the Platform only for lawful security research on systems you own or
          are authorized to test. Unauthorized access, DoS, or data theft is prohibited.
        </p>
      </LegalSection>

      <LegalSection title="4. Security Research Policy">
        <ul className="mt-3 space-y-2 pl-4">
          <LegalBullet>Stay within defined bounty or scan scope</LegalBullet>
          <LegalBullet>Report findings through official channels</LegalBullet>
          <LegalBullet>Follow our 90-day responsible disclosure timeline</LegalBullet>
        </ul>
      </LegalSection>

      <LegalSection title="5. Scan Targets and Authorization">
        <p>
          By submitting a target you warrant written authorization. We may suspend
          scans and accounts when abuse is detected.
        </p>
      </LegalSection>

      <LegalSection title="6. Bounty Program Rules">
        <p>
          Rewards follow CVSS 4.0 triage. Duplicates and self-inflicted findings are
          ineligible. ForgeGuard AI is the final arbiter of eligibility.
        </p>
      </LegalSection>

      <LegalSection title="7. Intellectual Property">
        <p>
          Platform IP remains ours. You retain ownership of your reports and Bazaar
          scripts subject to the Platform license.
        </p>
      </LegalSection>

      <LegalSection title="8. Privacy and Data Handling">
        <p>
          Use is subject to our{" "}
          <a href="/privacy" className="text-acid hover:underline">
            Privacy Policy
          </a>
          . API keys never touch client code; you may request account deletion in Settings.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORGEGUARD AI IS NOT LIABLE FOR
          INDIRECT OR CONSEQUENTIAL DAMAGES. Scan results are advisory, not exhaustive.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          We may suspend access for Terms violations. Data retention after termination
          is governed by the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to Terms">
        <p>Material changes are communicated via email. Continued use constitutes acceptance.</p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          <a href="mailto:legal@forgeguard.ai" className="text-acid hover:underline">
            legal@forgeguard.ai
          </a>
        </p>
      </LegalSection>
    </>
  );
}
