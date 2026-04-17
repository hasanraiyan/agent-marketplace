import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  StarIcon,
  ArrowRightIcon,
  CodeIcon,
  PenToolIcon,
  BarChart3Icon,
  SearchIcon,
  BrainIcon,
  ImageIcon,
  MessageSquareIcon,
  ShieldIcon,
} from "lucide-react";

const agents = [
  {
    name: "CodeReview Pro",
    creator: "DevTools Inc.",
    initials: "CR",
    description:
      "Automated code reviews with deep understanding of best practices, security vulnerabilities, and performance optimizations.",
    category: "Development",
    rating: 4.9,
    reviews: 1247,
    price: "Free",
    icon: CodeIcon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: true,
  },
  {
    name: "ContentWriter AI",
    creator: "CreativeAI Labs",
    initials: "CW",
    description:
      "Creates compelling blog posts, marketing copy, and social media content tailored to your brand voice.",
    category: "Writing",
    rating: 4.8,
    reviews: 892,
    price: "$9/mo",
    icon: PenToolIcon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: false,
  },
  {
    name: "DataInsight",
    creator: "Analytics Pro",
    initials: "DI",
    description:
      "Transforms raw data into actionable insights with automated visualizations, trend analysis, and reporting.",
    category: "Analytics",
    rating: 4.7,
    reviews: 634,
    price: "$19/mo",
    icon: BarChart3Icon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: false,
  },
  {
    name: "ResearchBot",
    creator: "DeepSearch Co.",
    initials: "RB",
    description:
      "Conducts thorough research across academic papers, web sources, and databases with cited summaries.",
    category: "Research",
    rating: 4.9,
    reviews: 1102,
    price: "$14/mo",
    icon: SearchIcon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: true,
  },
  {
    name: "BrainStorm",
    creator: "IdeaForge",
    initials: "BS",
    description:
      "Interactive brainstorming partner that generates innovative ideas, mind maps, and strategic frameworks.",
    category: "Strategy",
    rating: 4.6,
    reviews: 478,
    price: "Free",
    icon: BrainIcon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: false,
  },
  {
    name: "DesignAssist",
    creator: "PixelPerfect AI",
    initials: "DA",
    description:
      "Generates UI mockups, suggests design improvements, and creates asset variations from simple prompts.",
    category: "Design",
    rating: 4.8,
    reviews: 756,
    price: "$12/mo",
    icon: ImageIcon,
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    featured: false,
  },
];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      <StarIcon className="size-3.5 fill-primary text-primary" />
      <span className="text-sm font-medium">{rating}</span>
    </div>
  );
}

export function FeaturedAgentsSection() {
  return (
    <section id="agents" className="relative py-24 sm:py-32">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <StarIcon className="size-3" />
            Featured Agents
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Explore Top-Rated <span className="gradient-text">AI Agents</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Hand-picked agents trusted by thousands of professionals. Each one
            is verified, tested, and ready to deploy instantly.
          </p>
        </div>

        {/* Agent Grid */}
        <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card
              key={agent.name}
              className="group relative overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Hover gradient overlay */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${agent.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />

              <CardHeader className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 rounded-xl">
                      <AvatarFallback
                        className={`rounded-xl bg-gradient-to-br ${agent.gradient} text-xs font-semibold`}
                      >
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {agent.creator}
                      </p>
                    </div>
                  </div>
                  {agent.featured && (
                    <Badge className="bg-primary/15 text-primary text-[10px]">
                      Popular
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="relative">
                <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                  {agent.description}
                </CardDescription>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <agent.icon
                      className={agent.iconColor}
                      data-icon="inline-start"
                    />
                    {agent.category}
                  </Badge>
                  <StarRating rating={agent.rating} />
                  <span className="text-xs text-muted-foreground">
                    ({agent.reviews.toLocaleString()})
                  </span>
                </div>
              </CardContent>

              <CardFooter className="relative border-t border-border/30 bg-muted/20">
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    {agent.price}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs group-hover:text-primary"
                  >
                    View Agent
                    <ArrowRightIcon
                      data-icon="inline-end"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Browse All CTA */}
        <div className="mt-12 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            id="browse-all-btn"
          >
            Browse All Agents
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  );
}
