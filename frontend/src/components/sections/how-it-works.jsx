import { Badge } from "@/components/ui/badge";
import {
  SearchIcon,
  SlidersHorizontalIcon,
  RocketIcon,
  BarChart3Icon,
  ArrowDownIcon,
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: SearchIcon,
    title: "Discover",
    description:
      "Browse our curated marketplace of verified AI agents. Filter by category, rating, price, and capability to find the perfect match.",
    gradient: "from-primary to-primary/80",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
  },
  {
    number: "02",
    icon: SlidersHorizontalIcon,
    title: "Customize",
    description:
      "Configure agents to match your workflow. Set parameters, connect your tools, define guardrails, and tailor behavior to your needs.",
    gradient: "from-primary to-primary/80",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
  },
  {
    number: "03",
    icon: RocketIcon,
    title: "Deploy",
    description:
      "Launch your agents in seconds. They run in secure sandboxes with full observability — monitor tasks, costs, and results in real-time.",
    gradient: "from-primary to-primary/80",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
  },
  {
    number: "04",
    icon: BarChart3Icon,
    title: "Scale",
    description:
      "Orchestrate multi-agent workflows, track performance analytics, and scale from one agent to hundreds with enterprise controls.",
    gradient: "from-primary to-primary/80",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <RocketIcon data-icon="inline-start" />
            How It Works
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            From Zero to <span className="gradient-text">Deployed</span> in
            Minutes
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Getting started with AI agents has never been easier. Four simple
            steps to transform your workflow.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-border/0 via-border to-border/0 lg:block" />

          <div className="grid gap-8 sm:gap-12 lg:gap-16">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex flex-col items-center gap-6 lg:flex-row lg:gap-16 ${
                  i % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Content Side */}
                <div
                  className={`flex flex-1 flex-col ${i % 2 === 1 ? "lg:items-end lg:text-right" : "lg:items-start lg:text-left"} items-center text-center`}
                >
                  <span
                    className={`mb-3 inline-block bg-gradient-to-r ${step.gradient} bg-clip-text text-sm font-bold text-transparent`}
                  >
                    STEP {step.number}
                  </span>
                  <h3 className="text-2xl font-bold sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {/* Center Dot (desktop) */}
                <div className="relative z-10 hidden lg:flex">
                  <div
                    className={`flex size-16 items-center justify-center rounded-2xl ${step.bg} ring-2 ${step.ring} backdrop-blur-sm`}
                  >
                    <step.icon className="size-7 text-foreground" />
                  </div>
                </div>

                {/* Icon card (mobile) */}
                <div
                  className={`flex size-14 items-center justify-center rounded-xl ${step.bg} ring-1 ${step.ring} lg:hidden`}
                >
                  <step.icon className="size-6 text-foreground" />
                </div>

                {/* Empty space for layout balance */}
                <div className="hidden flex-1 lg:block" />

                {/* Arrow between steps (mobile) */}
                {i < steps.length - 1 && (
                  <div className="flex justify-center lg:hidden">
                    <ArrowDownIcon className="size-5 text-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
