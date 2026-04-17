import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

export function CTASection() {
  return (
    <section id="cta" className="relative py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-card/40 backdrop-blur-sm">
          {/* Background effects */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-chart-2/10 blur-3xl" />
            <div className="absolute inset-0 bg-dot-grid opacity-20" />
          </div>

          {/* Top gradient border */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative px-6 py-16 text-center sm:px-12 sm:py-24 lg:px-20">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 sm:size-16">
              <SparklesIcon className="size-7 text-primary sm:size-8" />
            </div>

            <h2 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Ready to Supercharge <br className="hidden sm:block" />
              <span className="gradient-text">Your Workflow?</span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Join thousands of professionals using AI agents to 10x their
              productivity. Start free, no credit card required.
            </p>

            <div className="mx-auto mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-12 rounded-xl border-border/50 bg-background/60 pl-4 text-base backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/30"
                id="cta-email-input"
              />
              <Button
                size="lg"
                className="h-12 gap-2 rounded-xl px-8 text-base glow-primary"
                id="cta-btn"
              >
                Get Started
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground/50">
              Free forever plan available · No credit card required · Cancel
              anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
