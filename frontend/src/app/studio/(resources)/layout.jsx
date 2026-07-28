"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobeIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConnectorsProvider,
  useConnectors,
} from "@/components/connectors/connectors-context";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { studioRoutes } from "@/lib/studio-routes";

/**
 * Section metadata for the creator resource routes. Studio's own sidebar is
 * the section navigation, so — unlike the old /dashboard/connectors layout —
 * there is no second nav rail here.
 */
const SECTIONS = [
  {
    match: studioRoutes.skills,
    title: "Skills",
    description: "Specialized instructions and capabilities for your agents.",
    newHref: studioRoutes.skillNew,
    newLabel: "New Skill",
    loadingKey: "loading",
  },
  {
    match: studioRoutes.knowledge,
    title: "Knowledge",
    description:
      "Upload documents and let your agents search them with AI-powered retrieval.",
    newHref: studioRoutes.knowledgeNew,
    newLabel: "New Knowledge Base",
    loadingKey: "loadingKnowledgeBases",
  },
  {
    match: studioRoutes.connectors,
    title: "Connectors",
    description: "MCP servers that give your agents external tools and APIs.",
    newHref: studioRoutes.connectorNew,
    newLabel: "Add Server",
    loadingKey: "loadingMcps",
  },
  {
    match: studioRoutes.memory,
    title: "Memory",
    description:
      "Profile preferences and long-term agent memories across conversations.",
    newHref: null,
    loadingKey: "loadingMemory",
  },
  {
    match: studioRoutes.providers,
    title: "Providers",
    description: "Connect the LLM providers that power your agents.",
    newHref: studioRoutes.providerNew,
    newLabel: "Add Provider",
    loadingKey: null,
  },
];

function ResourcesLayoutContent({ children }) {
  const pathname = usePathname();
  const connectors = useConnectors();

  const section =
    SECTIONS.find(
      (item) =>
        pathname === item.match || pathname.startsWith(`${item.match}/`),
    ) || SECTIONS[0];

  const inSkills = section.match === studioRoutes.skills;
  const isPublicSkills = pathname === studioRoutes.skillsPublic;
  // The new/edit/detail screens own their own toolbars; only the list roots
  // get the section-level "create" action.
  const isListRoot = pathname === section.match;

  useDashboardHeader(
    {
      title: section.title,
      description: section.description,
      actions: (
        <div className="flex items-center gap-2">
          {inSkills ? (
            <Link
              href={
                isPublicSkills ? studioRoutes.skills : studioRoutes.skillsPublic
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-full font-bold"
              >
                <GlobeIcon className="mr-1.5 size-3.5" />
                {isPublicSkills ? "My Skills" : "Browse Public"}
              </Button>
            </Link>
          ) : null}
          {isListRoot && section.newHref ? (
            <Link href={section.newHref}>
              <Button size="sm" className="rounded-full px-4 font-bold">
                <Plus className="mr-1.5 size-4" />
                {section.newLabel}
              </Button>
            </Link>
          ) : null}
        </div>
      ),
    },
    [pathname, isPublicSkills, isListRoot],
  );

  const isLoading =
    isListRoot && section.loadingKey ? connectors[section.loadingKey] : false;

  return (
    <main className="relative min-h-0 flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-48 w-full rounded-2xl" />
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
  );
}

export default function StudioResourcesLayout({ children }) {
  return (
    <ConnectorsProvider>
      <ResourcesLayoutContent>{children}</ResourcesLayoutContent>
    </ConnectorsProvider>
  );
}
