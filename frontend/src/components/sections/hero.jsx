import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowRightIcon,
  SparklesIcon,
  ZapIcon,
  ShieldCheckIcon,
  PlayIcon,
} from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-16"
    >
      {/* ── Background Effects ──────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-dot-grid opacity-50" />

        {/* Orb 1 */}
        <div className="animate-pulse-glow absolute -top-32 -left-32 size-96 rounded-full bg-primary/20" />
        {/* Orb 2 */}
        <div
          className="animate-pulse-glow absolute -right-24 top-1/3 size-80 rounded-full bg-chart-2/15"
          style={{ animationDelay: "2s" }}
        />
        {/* Orb 3 */}
        <div
          className="animate-pulse-glow absolute -bottom-20 left-1/3 size-72 rounded-full bg-chart-3/10"
          style={{ animationDelay: "4s" }}
        />

        {/* Radial fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background" />
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="animate-fade-up">
            <Badge
              variant="outline"
              className="mb-6 gap-2 border-primary/30 bg-primary/5 px-4 py-1.5 text-primary"
            >
              <SparklesIcon className="size-3.5" />
              Now in Beta — Join 2,000+ early adopters
            </Badge>
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: "0.1s" }}
          >
            Deploy & Orchestrate{" "}
            <span className="gradient-text">AI Agents</span> That Work For You
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-up mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
            style={{ animationDelay: "0.2s" }}
          >
            The professional platform for intelligent AI agents. Create,
            customize, and orchestrate agents for coding, writing, research, and
            beyond — all from one unified interface.
          </p>

          {/* CTA Row */}
          <div
            className="animate-fade-up mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="relative flex-1">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-12 rounded-xl border-border/50 bg-muted/50 pl-4 pr-4 text-base backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/30"
                id="hero-email-input"
              />
            </div>
            <Button
              size="lg"
              className="h-12 gap-2 rounded-xl px-6 text-base glow-primary"
              id="hero-cta-btn"
            >
              Get Early Access
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground/70"
            style={{ animationDelay: "0.4s" }}
          >
            <span className="flex items-center gap-1.5">
              <ZapIcon className="size-3.5 text-yellow-500" />
              Lightning fast setup
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
              SOC 2 Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <PlayIcon className="size-3.5 text-primary" />
              Free tier available
            </span>
          </div>

          {/* ── Hero Visual ────────────────────────────── */}
          <div
            className="animate-fade-up relative mt-16 w-full max-w-5xl"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-1 shadow-2xl shadow-primary/5 backdrop-blur-sm">
              {/* App mock header */}
              <div className="flex items-center gap-2 rounded-t-xl bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500/60" />
                  <div className="size-3 rounded-full bg-yellow-500/60" />
                  <div className="size-3 rounded-full bg-green-500/60" />
                </div>
                <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-lg bg-background/60 text-xs text-muted-foreground">
                  <span className="opacity-60">persona.ai</span>/dashboard
                </div>
              </div>
              {/* Dashboard mock */}
              <div className="grid grid-cols-1 gap-3 bg-background/40 p-4 sm:grid-cols-3">
                {/* Stat Cards */}
                {[
                  {
                    label: "Active Agents",
                    value: "24",
                    change: "+3 this week",
                    color: "text-primary",
                  },
                  {
                    label: "Tasks Completed",
                    value: "1,847",
                    change: "98.2% success",
                    color: "text-emerald-400",
                  },
                  {
                    label: "Time Saved",
                    value: "142h",
                    change: "This month",
                    color: "text-amber-400",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/30 bg-card/50 p-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/60">
                      {stat.change}
                    </p>
                  </div>
                ))}

                {/* Agent Activity List */}
                <div className="rounded-xl border border-border/30 bg-card/50 p-4 sm:col-span-2">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Recent Agent Activity
                  </p>
                  <div className="space-y-2.5">
                    {[
                      {
                        name: "CodeReview Pro",
                        status: "Completed",
                        task: "Reviewed PR #347",
                        time: "2m ago",
                        dot: "bg-emerald-400",
                      },
                      {
                        name: "DataAnalyst",
                        status: "Running",
                        task: "Processing Q4 metrics",
                        time: "Active",
                        dot: "bg-primary",
                      },
                      {
                        name: "ContentWriter",
                        status: "Queued",
                        task: "Blog draft pending",
                        time: "In queue",
                        dot: "bg-amber-400",
                      },
                    ].map((agent) => (
                      <div
                        key={agent.name}
                        className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`size-2 rounded-full ${agent.dot}`} />
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.task}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {agent.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Quick Actions
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                      <SparklesIcon className="size-3.5" />
                      Deploy Agent
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                      <ZapIcon className="size-3.5" />
                      Run Workflow
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow behind card */}
            <div className="pointer-events-none absolute inset-0 -z-10 translate-y-4 rounded-3xl bg-primary/10 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
