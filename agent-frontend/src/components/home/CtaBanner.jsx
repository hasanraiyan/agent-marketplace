// CtaBanner.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function CtaBanner() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-8 rounded-3xl bg-primary p-10 text-center text-primary-foreground md:p-16">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Ready to Build Your First Agent?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-primary-foreground/80">
              Join thousands of developers and teams who are already using Agent
              Marketplace to ship AI-powered solutions faster.
            </p>
          </div>
          <Button size="lg" variant="secondary" className="group w-full sm:w-auto" asChild>
            <Link to="/create" className="flex items-center gap-2">
              Get Started Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}