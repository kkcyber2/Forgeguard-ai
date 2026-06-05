import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/legal/legal-document-shell";
import { TermsContent } from "@/components/legal/terms-content";

export const metadata: Metadata = {
  title: "Terms of Service — ForgeGuard AI",
  description:
    "ForgeGuard AI Terms of Service. Governs use of red-teaming tools, bounty programs, and Aegis guardrails.",
};

const LAST_UPDATED = "May 22, 2026";

export default function TermsPage() {
  return (
    <LegalDocumentShell
      eyebrow="// terms"
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
    >
      <TermsContent />
    </LegalDocumentShell>
  );
}
