"use client";

import * as React from "react";

import { NavThreads } from "@/components/nav-threads";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUser } from "@clerk/nextjs";
import { useThreads } from "@/components/threads-context";
import { CompassIcon, UserIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";

// Persona is the consumer experience: discover an agent, use it, keep talking.
// Creator infrastructure (skills, knowledge, connectors, providers) lives in
// Agent Studio and is reached through the Agent Studio entry point above.
const NAV_MAIN = [
  {
    title: "Explore",
    url: "/dashboard",
    icon: <CompassIcon />,
    id: "onboarding-dashboard-explore",
  },
  {
    title: "My Agents",
    url: "/dashboard/agents",
    icon: <UserIcon />,
    id: "onboarding-dashboard-my-agents",
  },
];

const NAV_SECONDARY = [
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: <Settings2Icon />,
    id: "onboarding-dashboard-settings",
  },
];

export function AppSidebar({ ...props }) {
  const { user } = useUser();
  const userData = {
    name: user?.fullName || "Guest User",
    email: user?.primaryEmailAddress?.emailAddress || "",
    avatar: user?.imageUrl || "",
  };

  const {
    groups,
    loading: threadsLoading,
    loadingMore,
    hasMore,
    loadMore,
    renameThread,
    removeThread,
  } = useThreads();

  const handleRename = React.useCallback(
    async (threadId, title) => {
      try {
        await renameThread(threadId, title);
        toast.success("Thread renamed");
      } catch {
        toast.error("Failed to rename thread");
      }
    },
    [renameThread],
  );

  const handleDelete = React.useCallback(
    async (threadId) => {
      try {
        await removeThread(threadId);
        toast.success("Thread deleted");
      } catch {
        toast.error("Failed to delete thread");
      }
    },
    [removeThread],
  );

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-zinc-100 bg-[#fbfbfb] select-none"
      {...props}
    >
      <SidebarHeader className="border-b border-zinc-100/60 bg-zinc-50/20 px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:p-0 hover:bg-transparent"
            >
              <Link href="/" className="flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-[#1E60FF]" />
                <span className="font-display text-base font-semibold tracking-tight text-zinc-900 leading-none">
                  Persona<span className="text-zinc-400">.ai</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-3.5 py-3">
        <NavMain items={NAV_MAIN} />
        <NavThreads
          groups={groups}
          loading={threadsLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRename={handleRename}
          onDelete={handleDelete}
        />
        <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="p-3.5">
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
