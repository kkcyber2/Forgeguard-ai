import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { GridBackground } from "@/components/ui/grid-background";
import { getSessionUser } from "@/lib/supabase/server";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // If we're already signed in, bounce to the dashboard.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <GridBackground variant="mesh" className="opacity-60" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between px-6 md:px-8">
          <Link href="/" aria-label="ForgeGuard home">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-xs text-foreground-muted transition-colors hover:text-foreground"
          >
            ← Back to site
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <footer className="border-t-[0.5px] border-white/[0.06] px-6 py-4 md:px-8">
          <p className="font-mono text-[11px] text-foreground-subtle">
            forgeguard.ai · secure access channel
          </p>
        </footer>
      </div>
    </main>
  );
}
