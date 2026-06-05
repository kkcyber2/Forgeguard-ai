import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/legal/legal-document-shell";
import { PrivacyContent } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy — ForgeGuard AI",
  description:
    "ForgeGuard AI Privacy Policy. How we collect, use, and protect your data.",
};

const LAST_UPDATED = "May 22, 2026";

export default function PrivacyPage() {
  return (
    <LegalDocumentShell
      eyebrow="// privacy"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
    >
      <PrivacyContent />
    </LegalDocumentShell>
  );
}
