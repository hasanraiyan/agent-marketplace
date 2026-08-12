import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/sections/hero";
import { CategoriesSection } from "@/components/sections/categories";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { BuiltFromSection } from "@/components/sections/built-from";
import { CTASection } from "@/components/sections/cta";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <CategoriesSection />
        <HowItWorksSection />
        <BuiltFromSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
