"use client";

import Link from "next/link";
import { useConnectors } from "./connectors-context";
import { Cpu, FileText, Server, Database, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CONNECTOR_TYPES = [
  {
    id: "skills",
    title: "Skills",
    description: "Create specialized instructions and capabilities that teach your agents new behaviors.",
    icon: Cpu,
    footerIcon: FileText,
    bgColor: "bg-[#9333EA]", // Solid purple
    badgeBgColor: "bg-[#FAF5FF] text-[#9333EA] dark:bg-purple-950/30 dark:text-purple-300",
    href: "/dashboard/connectors/skills",
    badge: "CORE",
    countKey: "mySkills",
    emptyLabel: "Create your first skill",
  },
  {
    id: "knowledge",
    title: "Knowledge Bases",
    description: "Upload documents (PDF, TXT, MD) and let your agents search them with semantic understanding via AI-powered retrieval.",
    icon: FileText,
    footerIcon: Database,
    bgColor: "bg-[#10B981]", // Solid green
    badgeBgColor: "bg-[#ECFDF5] text-[#10B981] dark:bg-emerald-950/30 dark:text-emerald-300",
    href: "/dashboard/connectors/knowledge",
    badge: "RAG",
    countKey: "knowledgeBases",
    emptyLabel: "Create your first knowledge base",
  },
  {
    id: "mcps",
    title: "MCP Servers",
    description: "Connect your agents to external APIs, tools, and data sources through remote protocol servers.",
    icon: Server,
    footerIcon: Server,
    bgColor: "bg-[#0052FF]", // Solid blue
    badgeBgColor: "bg-[#EFF6FF] text-[#0052FF] dark:bg-blue-950/30 dark:text-blue-300",
    href: "/dashboard/connectors/mcps",
    badge: "PROTOCOL",
    countKey: "mcps",
    emptyLabel: "Add your first server",
  },
];

function ConnectorCard({ type, count, loading }) {
  const Icon = type.icon;
  const FooterIcon = type.footerIcon;

  return (
    <Link
      href={type.href}
      className="group flex flex-col rounded-3xl border border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.015)] dark:shadow-none hover:border-slate-200 dark:hover:border-zinc-700 hover:shadow-[0_8px_30px_0_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.99]"
    >
      {/* Icon */}
      <div
        className={`size-14 rounded-2xl ${type.bgColor} flex items-center justify-center text-white shadow-sm mb-6 group-hover:scale-105 transition-transform duration-300`}
      >
        <Icon className="size-6 text-white" />
      </div>

      {/* Title + Badge */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 group-hover:text-[#0052FF] dark:group-hover:text-blue-400 transition-colors tracking-tight">
          {type.title}
        </h2>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[6px] ${type.badgeBgColor}`}
        >
          {type.badge}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-6 flex-1 font-normal">
        {type.description}
      </p>

      {/* Divider */}
      <div className="w-full h-px bg-slate-100 dark:bg-zinc-800/80 mb-5" />

      {/* Count + CTA */}
      <div className="flex items-center justify-between">
        <div>
          {loading ? (
            <Skeleton className="h-5 w-16 rounded" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 font-medium">
              <FooterIcon className="size-4 text-slate-400 dark:text-zinc-500" />
              <span>
                {count} {count === 1 ? "item" : "items"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-[#0052FF] dark:text-blue-400 group-hover:gap-1.5 transition-all">
          Manage
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default function ConnectorsPage() {
  const { mySkills, mcps, knowledgeBases, loading, loadingMcps, loadingKnowledgeBases } = useConnectors();

  return (
    <div className="flex flex-col h-full bg-slate-50/40 dark:bg-zinc-950/20 overflow-y-auto">
      {/* Connector Type Cards */}
      <div className="flex-1 px-8 py-8 md:px-10 md:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
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
