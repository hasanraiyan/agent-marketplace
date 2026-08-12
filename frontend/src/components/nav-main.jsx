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
import { SlidersHorizontalIcon } from "lucide-react";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";

export function NavMain({ items, myAgentId }) {
  const pathname = usePathname();

  const isActive = (url) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  // Creator entry point. Points at the Studio workspace rather than a single
  // creation form; the old create route now redirects there too.
  const ctaHref = studioRoutes.home;
  const ctaLabel = "Agent Studio";
  const CtaIcon = SlidersHorizontalIcon;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="flex flex-col gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={ctaLabel}
              className="h-10 w-full justify-center gap-2 rounded-xl !bg-[#1E60FF] !text-white hover:!bg-[#154ed0] hover:!text-white font-bold text-sm tracking-wide shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-none"
            >
              <Link href={ctaHref} id="onboarding-dashboard-studio-cta">
                <CtaIcon className="size-4 shrink-0" />
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
                      : "text-slate-650 hover:text-slate-950 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/30",
                  )}
                >
                  <Link
                    href={item.url}
                    id={item.id}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={cn(
                        "transition-transform duration-200 group-hover/menu-button:translate-x-0.5",
                        active
                          ? "text-[#1E60FF]"
                          : "text-slate-450 dark:text-slate-500",
                      )}
                    >
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
