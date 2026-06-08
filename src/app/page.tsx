import { MarketingNav } from "@/components/marketing/nav";
import { MarketingHero } from "@/components/marketing/hero";
import { LogoMarquee } from "@/components/marketing/logo-marquee";
import { FeatureGrid } from "@/components/marketing/features";
import { AttackSurface } from "@/components/marketing/attack-surface";
import { Guardrails } from "@/components/marketing/guardrails";
import { PricingSection } from "@/components/marketing/pricing";
import { CtaBanner } from "@/components/marketing/cta";
import { MarketingFooter } from "@/components/marketing/footer";
import { ComplianceChatBubble } from "@/components/marketing/compliance-chat";
import { getSessionUser } from "@/lib/supabase/server";

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

  const destination = "/dashboard";

  const primaryCta = isAuthenticated
    ? { href: "/dashboard", label: "Open Dashboard" }
    : { href: "/auth/signup", label: "Start Free Audit" };

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />
      <MarketingHero isAuthenticated={isAuthenticated} primaryCta={primaryCta} />
      <LogoMarquee />
      <FeatureGrid />
      <AttackSurface />
      <Guardrails />
      <PricingSection isAuthenticated={isAuthenticated} />
      <CtaBanner isAuthenticated={isAuthenticated} primaryCta={primaryCta} />
      <MarketingFooter />
      <ComplianceChatBubble />
    </main>
  );
}
