"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeftIcon,
  Code2Icon,
  FolderKanbanIcon,
  PlusIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { developerRoutes } from "@/lib/developer-routes";
import { personaRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";

// Developer Studio's own sections. Only "Projects" exists in v1 — this list
// grows as later PRs add Project-scoped sub-navigation.
const DEVELOPER_NAV = [
  { title: "Projects", url: developerRoutes.projects, icon: FolderKanbanIcon },
];

function DeveloperNavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={item.title}
        isActive={active}
        className={cn(
          "h-9 rounded-xl px-3 transition-all duration-200",
          active
            ? "bg-slate-200/70 font-bold text-slate-900 shadow-xs dark:bg-slate-800/80 dark:text-white"
            : "text-slate-650 hover:bg-slate-100/50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-slate-100",
        )}
      >
        <Link href={item.url} className="flex items-center gap-2.5">
          <Icon
            className={cn(
              "size-4 shrink-0",
              active ? "text-[#1E60FF]" : "text-slate-450 dark:text-slate-500",
            )}
          />
          <span className="text-xs font-semibold">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function DeveloperSidebar({ ...props }) {
  const { user } = useUser();
  const pathname = usePathname();

  const userData = {
    name: user?.fullName || "Guest User",
    email: user?.primaryEmailAddress?.emailAddress || "",
    avatar: user?.imageUrl || "",
  };

  const isActive = (url) =>
    url === developerRoutes.home
      ? pathname === developerRoutes.home
      : pathname === url || pathname.startsWith(`${url}/`);

  return (
    <Sidebar
      collapsible="offcanvas"
      className="select-none border-r border-slate-100 bg-[#fbfbfb] dark:border-slate-850 dark:bg-[#0c0c0e]"
      {...props}
    >
      <SidebarHeader className="border-b border-slate-100/60 bg-slate-50/20 px-4 py-4 dark:border-slate-800/40 dark:bg-slate-950/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:p-0 hover:bg-transparent dark:hover:bg-transparent"
            >
              <Link
                href={developerRoutes.home}
                className="flex items-center gap-3"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-transform duration-300 hover:scale-[1.05] dark:bg-white dark:text-slate-900">
                  <Code2Icon className="size-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Developer<span className="text-[#1E60FF]"> Studio</span>
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    persona.hasanraiyan.me Project workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-3.5 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="flex flex-col gap-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="New Project"
                  className="h-10 w-full justify-center gap-2 rounded-xl border-none !bg-[#1E60FF] text-sm font-bold tracking-wide !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] hover:!text-white active:scale-[0.98]"
                >
                  <Link href={developerRoutes.projectNew}>
                    <PlusIcon className="size-4 shrink-0 transition-transform duration-300 group-hover/menu-button:rotate-90" />
                    <span>New Project</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarMenu className="gap-1">
              {DEVELOPER_NAV.map((item) => (
                <DeveloperNavLink
                  key={item.title}
                  item={item}
                  active={isActive(item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto border-t border-slate-150/50 p-0 pt-3 dark:border-slate-850/40">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Back to Persona"
                  className="h-9 rounded-xl px-3 text-slate-650 transition-all duration-200 hover:bg-slate-100/50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-slate-100"
                >
                  <Link
                    href={personaRoutes.explore}
                    className="flex items-center gap-2.5"
                  >
                    <ArrowLeftIcon className="size-4 shrink-0 text-slate-450 dark:text-slate-500" />
                    <span className="text-xs font-semibold">
                      Back to Persona
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3.5">
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
