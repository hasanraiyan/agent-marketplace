"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardHeaderState } from "@/components/dashboard-header-context";

const routeMap = [
  { path: "/dashboard/agents/create", title: "Create Agent" },
  { path: "/dashboard/agents", title: "My Agents" },
  { path: "/dashboard/skills", title: "Connectors" },
  { path: "/dashboard/settings/profile", title: "Profile" },
  { path: "/dashboard/settings/providers/new", title: "Add Provider" },
  { path: "/dashboard/settings/providers", title: "AI Providers" },
  { path: "/dashboard/settings/danger", title: "Danger Zone" },
  { path: "/dashboard/settings", title: "Settings" },
  { path: "/dashboard", title: "Explore" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const pageHeader = useDashboardHeaderState();

  // Find the matching title from routeMap
  // We sort by length descending to match the most specific path first
  const activeRoute = routeMap
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) =>
      route.path === "/"
        ? pathname === "/"
        : pathname === route.path || pathname.startsWith(`${route.path}/`),
    );

  const title =
    pageHeader.title || (activeRoute ? activeRoute.title : "Intelligence Hub");
  const actions =
    pageHeader.actions !== null && pageHeader.actions !== undefined
      ? pageHeader.actions
      : pathname !== "/dashboard/agents/create" && (
          <Link href="/dashboard/agents/create">
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Create Agent
            </Button>
          </Link>
        );

  return (
    <header className="sticky top-0 z-50 flex min-h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 lg:gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" />
          {pageHeader.leading}
          <div className="min-w-0 py-2">
            <h1 className="truncate text-base font-semibold text-foreground max-w-[100px] sm:max-w-none">
              {title}
            </h1>
            {pageHeader.description ? (
              <div className={`truncate text-xs text-muted-foreground ${pageHeader.tabs ? "hidden sm:block" : ""}`}>
                {pageHeader.description}
              </div>
            ) : null}
          </div>
        </div>
        {pageHeader.tabs && (
          <div className="flex items-center justify-center mx-2">
            {pageHeader.tabs}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
