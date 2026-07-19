"use client";


import { usePathname } from "next/navigation";
import { ConnectorsNav } from "@/components/skills/connectors-nav";
import { ConnectorsProvider, useConnectors } from "./connectors-context";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function ConnectorsLayoutContent({ children }) {
  const { loading, loadingMcps, loadingKnowledgeBases, loadingMemory } = useConnectors();
  const pathname = usePathname();

  const inMcps = pathname.startsWith("/dashboard/connectors/mcps");
  const inKnowledge = pathname.startsWith("/dashboard/connectors/knowledge");
  const inSkills = pathname.startsWith("/dashboard/connectors/skills");
  const inMemory = pathname.startsWith("/dashboard/connectors/memory");
  const isRoot = pathname === "/dashboard/connectors";

  const isLoading =
    (inMcps && loadingMcps) ||
    (inKnowledge && loadingKnowledgeBases) ||
    (inSkills && loading) ||
    (inMemory && loadingMemory);

  // For knowledge/new and knowledge/[id] we want to show the KB nav
  const isEditingOrCreate =
    pathname.includes("/new") || pathname.includes("/edit");

  const getTitle = () => {
    if (isRoot) return "Connectors";
    if (inMcps) return "MCP Servers";
    if (inKnowledge) return "Knowledge Bases";
    if (inMemory) return "AI Memory";
    return "Skills";
  };

  const getDescription = () => {
    if (isRoot) return "Choose a connector type to manage and extend your agents.";
    if (inMcps) return "Manage your Model Context Protocol server connections";
    if (inKnowledge) return "Upload documents and let your agents search them with AI-powered retrieval";
    if (inMemory) return "View and manage your AI memory — profile preferences and agent long-term memories";
    return "Manage your skills and capabilities";
  };

  const getActionHref = () => {
    if (inMcps) return "/dashboard/connectors/mcps/new";
    if (inKnowledge) return "/dashboard/connectors/knowledge/new";
    if (inMemory) return null;
    return "/dashboard/connectors/skills/new";
  };

  const getActionLabel = () => {
    if (inMcps) return "Add Server";
    if (inKnowledge) return "New KB";
    if (inMemory) return null;
    return "New Skill";
  };

  useDashboardHeader(
    {
      title: getTitle(),
      description: getDescription(),
      actions: isRoot ? (
        <Link href="/dashboard/agents/create">
          <Button className="bg-[#1E60FF] hover:bg-[#154ed0] text-white">
            <Plus className="size-4 mr-2" />
            Create Agent
          </Button>
        </Link>
      ) : !isEditingOrCreate && getActionHref() ? (
        <Link href={getActionHref()}>
          <Button size="sm">
            <Plus className="size-4 mr-2" />
            {getActionLabel()}
          </Button>
        </Link>
      ) : null,
    },
    [pathname, isRoot, isEditingOrCreate]
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      {!isRoot && (
        <ConnectorsNav />
      )}
      <main className="flex-1 overflow-y-auto relative">
        {!isRoot && isLoading && !inMcps ? (
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <Skeleton className="h-48 rounded-2xl w-full" />
                  <div className="space-y-2 px-1">
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function ConnectorsLayout({ children }) {
  return (
    <ConnectorsProvider>
      <ConnectorsLayoutContent>{children}</ConnectorsLayoutContent>
    </ConnectorsProvider>
  );
}
