"use client";

import { usePathname } from "next/navigation";
import { SkillsNav } from "@/components/skills/skills-nav";
import { SkillsProvider, useSkills } from "./skills-context";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { McpManager } from "@/components/skills/mcp-manager";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function SkillsLayoutContent({ children }) {
  const { mySkills, publicSkills, loading, activeTab, setActiveTab, selectedMcpId, setIsCreatingMcp } = useSkills();
  const pathname = usePathname();

  const isEditingOrCreate = pathname.includes("/new") || pathname.includes("/edit");

  useDashboardHeader(
    {
      title: "Connectors",
      description: "Manage skills and MCP servers to extend your agents' capabilities.",
      tabs: !isEditingOrCreate ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 h-8">
            <TabsTrigger
              value="skills"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Skills
            </TabsTrigger>
            <TabsTrigger
              value="mcps"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              MCPs
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null,
      actions: !isEditingOrCreate ? (
        activeTab === "skills" ? (
          <Link href="/dashboard/skills/new">
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              New Skill
            </Button>
          </Link>
        ) : (
          <Button size="sm" onClick={() => setIsCreatingMcp(true)}>
            <Plus className="size-4 mr-2" />
            Add Server
          </Button>
        )
      ) : null,
    },
    [activeTab, isEditingOrCreate, setIsCreatingMcp]
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      <SkillsNav mySkills={mySkills} publicSkills={publicSkills} />
      <main className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="size-8 border-4 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : activeTab === "mcps" && !isEditingOrCreate ? (
          <McpManager key={selectedMcpId} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function SkillsLayout({ children }) {
  return (
    <SkillsProvider>
      <SkillsLayoutContent>{children}</SkillsLayoutContent>
    </SkillsProvider>
  );
}

