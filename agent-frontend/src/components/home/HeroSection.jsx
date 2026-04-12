// HeroSection.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col items-center justify-center overflow-hidden bg-background py-20 text-center">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      <div className="container relative z-10 flex max-w-4xl flex-col items-center gap-8 px-4">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
          <Sparkles className="size-4 text-primary" />
          <span className="text-muted-foreground">Over 850+ AI agents available</span>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          Discover, Build & Deploy <br className="hidden md:block" />
          <span className="text-primary">AI Agents</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          The all-in-one marketplace for AI agents. Browse community templates,
          customize them for your needs, and deploy to production in minutes.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link to="/browse" className="flex items-center gap-2">
              Browse Agents
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
            <Link to="/create">Create Your Agent</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Free tier available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Deploy in minutes</span>
          </div>
        </div>
      </div>
    </section>
  );
}