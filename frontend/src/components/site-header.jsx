"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

const routeMap = [
  { path: "/dashboard/agents/create", title: "Create Agent" },
  { path: "/dashboard/agents", title: "My Agents" },
  { path: "/dashboard/chats", title: "Chats" },
  { path: "/dashboard/profile", title: "Profile" },
  { path: "/dashboard/settings", title: "Settings" },
  { path: "/dashboard", title: "Dashboard" },
  { path: "/agents", title: "Marketplace" },
];

export function SiteHeader() {
  const pathname = usePathname();

  // Find the matching title from routeMap
  // We sort by length descending to match the most specific path first
  const activeRoute = routeMap
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) =>
      route.path === "/"
        ? pathname === "/"
        : pathname === route.path || pathname.startsWith(`${route.path}/`),
    );

  const title = activeRoute ? activeRoute.title : "Intelligence Hub";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" />
        <h1 className="text-base font-medium text-muted-foreground/80">
          <span className="text-foreground font-semibold">{title}</span>
        </h1>
      </div>
    </header>
  );
}
