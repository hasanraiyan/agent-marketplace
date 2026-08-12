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
      className="p-0 mt-auto border-t border-zinc-200/50 pt-3"
    >
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
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
                      ? "bg-zinc-200/70 text-zinc-900 font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/50",
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
                        active ? "text-[#1E60FF]" : "text-zinc-400",
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
