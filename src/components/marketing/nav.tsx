"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Menu, X } from "lucide-react";

const navItems = [
  { label: "Platform", href: "/#platform" },
  { label: "Red Team", href: "/#redteam" },
  { label: "Guardrails", href: "/#guardrails" },
  { label: "Demo", href: "/demo" },
  { label: "Docs", href: "/#docs" },
];

/**
 * Marketing nav. Accepts a server-resolved session prop so we render the
 * correct CTA on first paint — no client-side flash of "Sign in" for users
 * who are already authenticated.
 */
export interface MarketingNavSession {
  isAuthenticated: boolean;
  destination: string; // /admin or /dashboard
}

export function MarketingNav({ session }: { session: MarketingNavSession }) {
  const { scrollY } = useScroll();
  const bg = useTransform(
    scrollY,
    [0, 120],
    ["rgba(5,5,5,0)", "rgba(5,5,5,0.78)"],
  );
  const border = useTransform(
    scrollY,
    [0, 120],
    ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"],
  );
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <motion.header
        style={{ backgroundColor: bg, borderColor: border }}
        className={cn(
          "fixed top-0 inset-x-0 z-50 border-b-[0.5px] backdrop-blur-md",
          "transition-shadow duration-200",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6 md:px-8">
          <Link href="/" aria-label="ForgeGuard AI home">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm text-foreground-muted hover:text-foreground transition-colors rounded-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {session.isAuthenticated ? (
              <Link
                href={session.destination}
                className={buttonStyles({ variant: "primary", size: "sm" })}
              >
                Go to dashboard
                <ArrowUpRight size={14} strokeWidth={1.75} />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className={buttonStyles({
                    variant: "ghost",
                    size: "sm",
                    className: "hidden sm:inline-flex",
                  })}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className={buttonStyles({ variant: "primary", size: "sm" })}
                >
                  Deploy
                </Link>
              </>
            )}
            <button
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-sm border-hairline border-white/10 text-foreground-muted hover:text-foreground"
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-x-0 top-14 z-40 border-b-[0.5px] border-white/[0.06] bg-obsidian-950/95 backdrop-blur-md md:hidden",
          "transition-[opacity,transform] duration-200",
          open ? "opacity-100 translate-y-0" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <nav className="flex flex-col px-6 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="py-3 text-sm text-foreground-muted hover:text-foreground border-b-[0.5px] border-white/[0.04] last:border-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
