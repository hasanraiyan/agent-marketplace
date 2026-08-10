"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavSecondary({ items, ...props }) {
  const pathname = usePathname();

  return (
    <SidebarGroup
      {...props}
      className="p-0 mt-auto border-t border-slate-150/50 dark:border-slate-850/40 pt-3"
    >
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 px-1.5">
          {items.map((item) => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className={cn(
                    "h-8.5 rounded-xl transition-all duration-200 px-3",
                    active
                      ? "bg-slate-200/70 text-slate-900 font-bold dark:bg-slate-800/80 dark:text-white"
                      : "text-slate-650 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/30",
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-2.5">
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
