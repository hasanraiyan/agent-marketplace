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
import { cn } from "@/lib/utils";

export function NavMain({ items }) {
  const pathname = usePathname();

  const isActive = (url) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
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
                      ? "bg-zinc-200/70 text-zinc-900 font-bold shadow-xs"
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
