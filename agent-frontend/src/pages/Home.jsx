import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import FeaturedAgents from '@/components/home/FeaturedAgents';
import CategoriesSection from '@/components/home/CategoriesSection';
import HowItWorks from '@/components/home/HowItWorks';
import StatsSection from '@/components/home/StatsSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import CtaBanner from '@/components/home/CtaBanner';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturedAgents />
        <StatsSection />
        <CategoriesSection />
        <HowItWorks />
        <TestimonialsSection />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
