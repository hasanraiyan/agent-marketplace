"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ConnectorsNav } from "@/components/skills/connectors-nav";
import { ConnectorsProvider, useConnectors } from "./connectors-context";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function ConnectorsLayoutContent({ children }) {
  const { mySkills, publicSkills, loading, activeTab, setActiveTab } = useConnectors();
  const pathname = usePathname();

  const inMcps = pathname.startsWith("/dashboard/connectors/mcps");
  const inSkills = pathname.startsWith("/dashboard/connectors/skills");

  // Determine active tab from the pathname
  const currentTab = inMcps ? "mcps" : "skills";
  useEffect(() => {
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab, activeTab, setActiveTab]);

  const isEditingOrCreate =
    pathname.includes("/new") || pathname.includes("/edit");

  useDashboardHeader(
    {
      title: "Connectors",
      description: "Manage skills and MCP servers to extend your agents' capabilities.",
      tabs: !isEditingOrCreate ? (
        <Tabs value={currentTab} className="w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 h-8">
            <TabsTrigger
              value="skills"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
              asChild
            >
              <Link href="/dashboard/connectors/skills">Skills</Link>
            </TabsTrigger>
            <TabsTrigger
              value="mcps"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
              asChild
            >
              <Link href="/dashboard/connectors/mcps">MCPs</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null,
      actions: !isEditingOrCreate ? (
        currentTab === "skills" ? (
          <Link href="/dashboard/connectors/skills/new">
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              New Skill
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard/connectors/mcps/new">
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Add Server
            </Button>
          </Link>
        )
      ) : null,
    },
    [currentTab, isEditingOrCreate]
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      <ConnectorsNav mySkills={mySkills} publicSkills={publicSkills} />
      <main className="flex-1 overflow-y-auto relative">
        {loading ? (
          <div className="p-6">
            {currentTab === "skills" ? (
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
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 border rounded-2xl">
                    <Skeleton className="size-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-1/3 rounded-md" />
                      <Skeleton className="h-3 w-2/3 rounded-md" />
                      <div className="flex items-center gap-3 mt-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
