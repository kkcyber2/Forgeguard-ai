import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";

const columns: Array<{ title: string; items: { label: string; href: string }[] }> = [
  {
    title: "Product",
    items: [
      { label: "Platform", href: "/#platform" },
      { label: "Red-team", href: "/#redteam" },
      { label: "Guardrails", href: "/#guardrails" },
      { label: "Live demo", href: "/demo" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Docs", href: "/#docs" },
      { label: "ATLAS coverage", href: "/#redteam" },
      { label: "Changelog", href: "/#docs" },
      { label: "Security", href: "/#security" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/#about" },
      { label: "Careers", href: "/#careers" },
      { label: "Contact", href: "mailto:security@forgeguard.ai" },
      { label: "Legal", href: "/#legal" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative border-t-[0.5px] border-white/[0.06] bg-obsidian-950/70 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-hairline bg-grid-lg opacity-[0.3]" />
      <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-8">
        <div className="grid grid-cols-2 gap-y-12 md:grid-cols-5 md:gap-8">
          <div className="col-span-2 max-w-sm">
            <Logo />
            <p className="mt-4 text-sm text-foreground-muted text-pretty">
              Adversarial red-teaming and runtime guardrails for production
              LLM deployments.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Badge tone="live" dot>
                Status · all systems operational
              </Badge>
            </div>
          </div>
          {columns.map((col) => (
            <nav key={col.title}>
              <h4 className="text-eyebrow text-foreground-subtle">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.items.map((i) => (
                  <li key={`${i.href}-${i.label}`}>
                    <Link
                      href={i.href}
                      className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t-[0.5px] border-white/[0.06] pt-6 md:flex-row md:items-center">
          <p className="font-mono text-xs text-foreground-subtle">
            © {new Date().getFullYear()} ForgeGuard AI · All attacks reserved
          </p>
          <div className="flex items-center gap-4 text-xs text-foreground-subtle">
            <Link href="/#legal" className="hover:text-foreground">Privacy</Link>
            <span>·</span>
            <Link href="/#legal" className="hover:text-foreground">Terms</Link>
            <span>·</span>
            <Link href="/#security" className="hover:text-foreground">Disclosure</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
