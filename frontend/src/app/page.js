import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/sections/hero";
import { FeaturedAgentsSection } from "@/components/sections/featured-agents";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { CategoriesSection } from "@/components/sections/categories";
import { StatsSection } from "@/components/sections/stats";
import { PricingSection } from "@/components/sections/pricing";
import { CTASection } from "@/components/sections/cta";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturedAgentsSection />
        <CategoriesSection />
        <HowItWorksSection />
        <StatsSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
