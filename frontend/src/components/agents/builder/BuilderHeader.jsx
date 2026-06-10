"use client";

import Link from "next/link";
import { ArrowLeft, BotIcon, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardHeader } from "@/components/dashboard-header-context";

export function BuilderHeader({
  agent,
  activeTab,
  setActiveTab,
  isEdit,
  agentId,
}) {
  useDashboardHeader(
    {
      title: agent?.name || "New Agent",
      description:
        activeTab === "configure"
          ? "Configure agent details"
          : activeTab === "preview"
          ? "Test your agent"
          : "Build with Sage",
      leading: (
        <Avatar className="size-8">
          <AvatarImage src={agent?.avatarUrl || agent?.avatar} />
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      ),
      tabs: (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 h-8">
            <TabsTrigger
              value="chat"
              className="h-7 px-3 text-xs lg:hidden data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="configure"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Configure
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-7 px-3 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
            >
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ),
      actions: (
        <>
          <Link
            href="/dashboard/agents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            My Agents
          </Link>
          <Badge
            variant="outline"
            className="h-5 rounded-md py-0 text-[10px] uppercase"
          >
            {isEdit ? agent?.visibility || "private" : "Draft"}
          </Badge>
          {isEdit ? (
            <Link href={`/dashboard/agents/${agentId}/run`}>
              <Button size="sm" className="h-8 rounded-full px-4 font-bold">
                <Play className="mr-1 size-3.5" />
                Run
              </Button>
            </Link>
          ) : null}
        </>
      ),
    },
    [activeTab, agent, agentId, isEdit, setActiveTab],
  );

  return null;
}
