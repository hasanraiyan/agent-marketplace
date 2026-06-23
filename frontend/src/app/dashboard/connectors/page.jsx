"use client";

import Link from "next/link";
import { useConnectors } from "./connectors-context";
import { Cpu, Server, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { BookText } from "lucide-react";

const CONNECTOR_TYPES = [
  {
    id: "skills",
    title: "Skills",
    description: "Specialized instructions and capabilities that teach your agents new behaviors.",
    icon: Cpu,
    gradient: "from-violet-500 to-purple-600",
    href: "/dashboard/connectors/skills",
    badge: "Core",
    countKey: "mySkills",
    emptyLabel: "Create your first skill",
  },
  {
    id: "knowledge",
    title: "Knowledge Bases",
    description: "Upload documents (PDF, TXT, MD) and let your agents search them with semantic understanding via AI-powered retrieval.",
    icon: BookText,
    gradient: "from-emerald-500 to-teal-600",
    href: "/dashboard/connectors/knowledge",
    badge: "RAG",
    countKey: "knowledgeBases",
    emptyLabel: "Create your first knowledge base",
  },
  {
    id: "mcps",
    title: "MCP Servers",
    description: "Remote protocol servers that connect your agents to external APIs, tools, and data sources.",
    icon: Server,
    gradient: "from-sky-500 to-blue-600",
    href: "/dashboard/connectors/mcps",
    badge: "Protocol",
    countKey: "mcps",
    emptyLabel: "Add your first server",
  },
];

function ConnectorCard({ type, count, loading }) {
  const Icon = type.icon;
  return (
    <Link
      href={type.href}
      className="group flex flex-col rounded-3xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-6 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98]"
    >
      {/* Icon */}
      <div
        className={`size-14 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center text-white shadow-sm mb-5 group-hover:scale-105 transition-transform duration-300`}
      >
        <Icon className="size-7" />
      </div>

      {/* Title + Badge */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">
          {type.title}
        </h2>
        <Badge
          variant="outline"
          className="text-[8px] uppercase h-4 px-1.5 border-primary/20 text-primary font-bold"
        >
          {type.badge}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
        {type.description}
      </p>

      {/* Count + CTA */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-150/60 dark:border-zinc-900/60">
        <div>
          {loading ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : count > 0 ? (
            <Badge
              variant="secondary"
              className="rounded-full text-xs font-bold px-3"
            >
              {count} {count === 1 ? "item" : "items"}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic font-medium">
              {type.emptyLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
          Browse
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default function ConnectorsPage() {
  const { mySkills, mcps, knowledgeBases, loading, loadingMcps, loadingKnowledgeBases } = useConnectors();

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Connector Type Cards */}
      <div className="flex-1 px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 max-w-4xl">
          {CONNECTOR_TYPES.map((type) => {
            const count =
              type.countKey === "mySkills"
                ? mySkills?.length || 0
                : type.countKey === "knowledgeBases"
                  ? knowledgeBases?.length || 0
                  : type.countKey === "mcps"
                    ? mcps?.length || 0
                    : 0;
            const isLoading =
              type.countKey === "mySkills"
                ? loading
                : type.countKey === "knowledgeBases"
                  ? loadingKnowledgeBases
                  : loadingMcps;

            return (
              <ConnectorCard
                key={type.id}
                type={type}
                count={count}
                loading={isLoading}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
