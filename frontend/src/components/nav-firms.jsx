"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyFirms } from "@/lib/api/client-projects";
import { personaRoutes } from "@/lib/studio-routes";
import { FirmAvatar } from "@/components/firms/firm-avatar";
import { cn } from "@/lib/utils";

const MAX_ROWS = 8;

/**
 * "My firms" — the firms this person has worked with, like a subscriptions
 * list. Hidden entirely when there's nothing to show.
 */
export function NavFirms() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;
    let cancelled = false;
    getMyFirms()
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.data || [])
          .map((r) => r.firm || r)
          .filter((f) => f && f.slug);
        setRows(list.slice(0, MAX_ROWS));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  if (rows === null) {
    return (
      <SidebarGroup className="border-t border-zinc-100/60 px-0 pt-4 group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="mb-2 px-3 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
          My firms
        </SidebarGroupLabel>
        <SidebarMenu>
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="size-5 rounded-[6px]" />
                <Skeleton className="h-3.5 flex-1 rounded-md" />
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  if (rows.length === 0) return null;

  return (
    <SidebarGroup className="border-t border-zinc-100/60 px-0 pt-4 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="mb-2 px-3 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
        My firms
      </SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">
        {rows.map((firm) => {
          const href = personaRoutes.firm(firm.slug);
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <SidebarMenuItem key={firm._id || firm.slug}>
              <SidebarMenuButton
                asChild
                tooltip={firm.name}
                isActive={active}
                className={cn(
                  "h-9 rounded-xl px-3 transition-all duration-200",
                  active
                    ? "bg-zinc-200/60 font-semibold text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:bg-zinc-100/50 hover:text-zinc-950",
                )}
              >
                <Link href={href} className="flex items-center gap-2.5">
                  <FirmAvatar
                    firm={firm}
                    className="size-5 border-0"
                    rounded="rounded-[6px]"
                  />
                  <span className="truncate text-xs font-medium">{firm.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
