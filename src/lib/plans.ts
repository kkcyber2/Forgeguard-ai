/**
 * plans.ts — client-safe plan definitions
 *
 * This file is intentionally separate from lemonsqueezy.ts which carries
 * `import "server-only"`. Anything that needs PLANS or PlanMeta in a Client
 * Component (e.g. pricing.tsx, billing UI) should import from here, NOT from
 * lemonsqueezy.ts.
 */

export type PlanId = "free" | "startup" | "enterprise";

export interface PlanMeta {
  id: PlanId;
  name: string;
  price: number;        // USD/month (0 = free)
  scansPerMonth: number; // 999_999 = unlimited
  engine: string;
  pdfReport: boolean;
  apiAccess: boolean;
  badge?: string;
  description: string;
  features: string[];
}

export const PLANS: PlanMeta[] = [
  {
    id: "free",
    name: "Hacker",
    price: 0,
    scansPerMonth: 3,
    engine: "Llama-3-8B",
    pdfReport: false,
    apiAccess: false,
    description: "Explore AI red-teaming with no commitment.",
    features: [
      "3 scans / month",
      "Llama-3-8B attack engine",
      "Full finding breakdown",
      "OWASP LLM coverage map",
    ],
  },
  {
    id: "startup",
    name: "Startup",
    price: 49,
    scansPerMonth: 50,
    engine: "DeepSeek-V3",
    pdfReport: true,
    apiAccess: false,
    badge: "Most Popular",
    description: "For teams shipping AI products that need real security.",
    features: [
      "50 scans / month",
      "DeepSeek-V3 attack engine",
      "Full Audit Report PDF",
      "OWASP LLM coverage map",
      "Remediation roadmap",
      "Email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    scansPerMonth: 999_999,
    engine: "DeepSeek-R1 (High Reasoning)",
    pdfReport: true,
    apiAccess: true,
    description: "Unlimited power for security teams and regulated industries.",
    features: [
      "Unlimited scans",
      "DeepSeek-R1 reasoning engine",
      "Full Audit Report PDF",
      "REST API access (/api/v1)",
      "Priority Slack support",
      "Custom attack playbooks",
      "SLA guarantee",
    ],
  },
];

export function getPlanMeta(id: PlanId): PlanMeta {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
