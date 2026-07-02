"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PlusIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavMain({ items, myAgentId }) {
  const pathname = usePathname();

  const isActive = (url) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const ctaHref = myAgentId ? `/dashboard/agents/${myAgentId}` : "/dashboard/agents/create";
  const ctaLabel = myAgentId ? "My Persona" : "Create Agent";
  const CtaIcon = myAgentId ? UserIcon : PlusIcon;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="flex flex-col gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={ctaLabel}
              className="h-10 w-full justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E60FF] via-[#4f46e5] to-[#1E60FF] bg-[length:200%_auto] text-white hover:bg-[position:right_center] font-bold text-sm tracking-wide shadow-md shadow-indigo-500/15 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-none"
            >
              <Link href={ctaHref}>
                <CtaIcon className="size-4 shrink-0 transition-transform duration-300 group-hover/menu-button:rotate-90" />
                <span>{ctaLabel}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={active}
                  className={cn(
                    "h-9 rounded-xl transition-all duration-200 px-3",
                    active
                      ? "bg-slate-200/70 text-slate-900 font-bold dark:bg-slate-800/80 dark:text-white shadow-xs"
                      : "text-slate-650 hover:text-slate-950 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/30"
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-2.5">
                    <span className={cn(
                      "transition-transform duration-200 group-hover/menu-button:translate-x-0.5",
                      active ? "text-[#1E60FF]" : "text-slate-450 dark:text-slate-500"
                    )}>
                      {item.icon}
                    </span>
                    <span className="text-xs font-semibold">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
