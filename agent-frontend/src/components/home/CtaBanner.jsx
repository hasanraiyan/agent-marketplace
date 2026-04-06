import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function CtaBanner() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-10 md:p-16 text-center text-primary-foreground">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to Build Your First Agent?
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto mb-8">
            Join thousands of developers and teams who are already using Agent
            Marketplace to ship AI-powered solutions faster.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/create">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
