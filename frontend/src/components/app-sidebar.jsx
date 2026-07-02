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
import { useUser, useAuth } from "@clerk/nextjs";
import { useThreads } from "@/components/threads-context";
import { getMyAgent } from "@/lib/api/agents";
import {
  CompassIcon,
  UserIcon,
  Settings2Icon,
  CircleHelpIcon,
  SparklesIcon,
  CpuIcon,
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
    icon: <UserIcon />,
  },
  {
    title: "Connectors",
    url: "/dashboard/connectors",
    icon: <CpuIcon />,
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
  const { isLoaded, isSignedIn } = useAuth();
  const userData = {
    name: user?.fullName || "Guest User",
    email: user?.primaryEmailAddress?.emailAddress || "",
    avatar: user?.imageUrl || "",
  };

  const [myAgentId, setMyAgentId] = React.useState(null);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    getMyAgent()
      .then((agent) => {
        if (!cancelled) setMyAgentId(agent?.id || agent?._id || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

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
      className="border-r border-slate-100 bg-[#fbfbfb] dark:border-slate-850 dark:bg-[#0c0c0e] select-none"
      {...props}
    >
      <SidebarHeader className="border-b border-slate-100/60 dark:border-slate-800/40 py-4 px-4 bg-slate-50/20 dark:bg-slate-950/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:p-0 hover:bg-transparent dark:hover:bg-transparent"
            >
              <Link href="/" className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#1E60FF] via-[#5d73ff] to-[#8c52ff] text-white shadow-md shadow-[#1E60FF]/25 dark:shadow-none transition-transform duration-300 hover:scale-[1.05]">
                  <SparklesIcon className="size-4.5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    Persona<span className="text-[#1E60FF] font-black">.ai</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                    v1.0.0
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-3.5 py-3 gap-4">
        <NavMain items={NAV_MAIN} myAgentId={myAgentId} />
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
