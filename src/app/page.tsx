import { MarketingNav } from "@/components/marketing/nav";
import { MarketingHero } from "@/components/marketing/hero";
import { LogoMarquee } from "@/components/marketing/logo-marquee";
import { FeatureGrid } from "@/components/marketing/features";
import { AttackSurface } from "@/components/marketing/attack-surface";
import { Guardrails } from "@/components/marketing/guardrails";
import { CtaBanner } from "@/components/marketing/cta";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";

/**
 * Landing page. Server Component.
 * --------------------------------
 * Resolves the viewer's session on the server so client child components
 * (nav, hero, cta) render the correct CTA on first paint. No hydration
 * flash from "Sign in" → "Go to dashboard".
 */
export default async function HomePage() {
  const user = await getSessionUser();
  const isAuthenticated = !!user;

  // Admins land on /admin; everyone else on /dashboard.
  let destination = "/dashboard";
  if (isAuthenticated) {
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") destination = "/admin";
  }

  const primaryCta = isAuthenticated
    ? { href: "/dashboard/scans/new", label: "Start a new scan" }
    : { href: "/auth/signup", label: "Deploy ForgeGuard" };

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />
      <MarketingHero isAuthenticated={isAuthenticated} primaryCta={primaryCta} />
      <LogoMarquee />
      <FeatureGrid />
      <AttackSurface />
      <Guardrails />
      <CtaBanner isAuthenticated={isAuthenticated} primaryCta={primaryCta} />
      <MarketingFooter />
    </main>
  );
}
