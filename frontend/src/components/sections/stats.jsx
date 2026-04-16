import { Badge } from "@/components/ui/badge";
import { TrendingUpIcon } from "lucide-react";

const stats = [
  { value: "10,000+", label: "Active Users", sublabel: "Growing daily" },
  { value: "250+", label: "AI Agents", sublabel: "Verified & tested" },
  { value: "2.4M", label: "Tasks Completed", sublabel: "And counting" },
  { value: "99.9%", label: "Uptime SLA", sublabel: "Enterprise-grade" },
];

const logos = ["Acme Corp", "TechFlow", "DataVault", "CloudSync", "NexGen"];

export function StatsSection() {
  return (
    <section id="stats" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/20 via-background to-muted/20" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <TrendingUpIcon className="size-3" />
            Traction
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Trusted by <span className="gradient-text">Thousands</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Teams and individuals around the world rely on Persona.ai to
            supercharge their productivity.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stagger-children grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/50 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-8"
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <p className="relative text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {stat.value}
              </p>
              <p className="relative mt-2 text-sm font-medium text-foreground/80">
                {stat.label}
              </p>
              <p className="relative mt-0.5 text-xs text-muted-foreground">
                {stat.sublabel}
              </p>
            </div>
          ))}
        </div>

        {/* Social Proof Logos */}
        <div className="mt-16 flex flex-col items-center">
          <p className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {logos.map((logo) => (
              <span
                key={logo}
                className="text-base font-semibold tracking-wide text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 sm:text-lg"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
