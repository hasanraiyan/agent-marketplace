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
import {
  CompassIcon,
  BrainIcon,
  Settings2Icon,
  CircleHelpIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

const NAV_MAIN = [
  {
    title: "Explore",
    url: "/dashboard",
    icon: <CompassIcon />,
  },
  {
    title: "My Agents",
    url: "/dashboard/agents",
    icon: <BrainIcon />,
  },
];

const NAV_SECONDARY = [
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: <Settings2Icon />,
  },
  {
    title: "Help & Docs",
    url: "#",
    icon: <CircleHelpIcon />,
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
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <SparklesIcon className="size-5! text-primary" />
                <span className="text-base font-bold tracking-tight">
                  Persona<span className="text-primary">.ai</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
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
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
