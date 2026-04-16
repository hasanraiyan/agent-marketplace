import { Badge } from "@/components/ui/badge";
import {
  CodeIcon,
  PenToolIcon,
  BarChart3Icon,
  SearchIcon,
  BrainIcon,
  ImageIcon,
  MessageSquareIcon,
  ShieldIcon,
  ArrowRightIcon,
  LayoutGridIcon,
} from "lucide-react";

const categories = [
  {
    icon: CodeIcon,
    label: "Development",
    count: 48,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "hover:border-blue-500/30",
  },
  {
    icon: PenToolIcon,
    label: "Writing",
    count: 35,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "hover:border-violet-500/30",
  },
  {
    icon: BarChart3Icon,
    label: "Analytics",
    count: 29,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "hover:border-emerald-500/30",
  },
  {
    icon: SearchIcon,
    label: "Research",
    count: 42,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "hover:border-amber-500/30",
  },
  {
    icon: BrainIcon,
    label: "Strategy",
    count: 21,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "hover:border-pink-500/30",
  },
  {
    icon: ImageIcon,
    label: "Design",
    count: 33,
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
    border: "hover:border-fuchsia-500/30",
  },
  {
    icon: MessageSquareIcon,
    label: "Support",
    count: 27,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "hover:border-cyan-500/30",
  },
  {
    icon: ShieldIcon,
    label: "Security",
    count: 18,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "hover:border-red-500/30",
  },
];

export function CategoriesSection() {
  return (
    <section id="categories" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-muted/10 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <LayoutGridIcon className="size-3" />
            Categories
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Browse by <span className="gradient-text">Category</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Find the right agent for every use case. Our marketplace spans
            dozens of categories and specializations.
          </p>
        </div>

        {/* Category Grid */}
        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
          {categories.map((cat) => (
            <button
              key={cat.label}
              className={`group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:shadow-lg ${cat.border} sm:p-6`}
            >
              <div
                className={`flex size-12 items-center justify-center rounded-xl ${cat.bg} transition-transform duration-300 group-hover:scale-110 sm:size-14`}
              >
                <cat.icon className={`size-5 ${cat.color} sm:size-6`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold sm:text-base">
                  {cat.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {cat.count} agents
                </p>
              </div>
              <ArrowRightIcon className="size-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
