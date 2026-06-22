"use client";


import { usePathname } from "next/navigation";
import { ConnectorsNav } from "@/components/skills/connectors-nav";
import { ConnectorsProvider, useConnectors } from "./connectors-context";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function ConnectorsLayoutContent({ children }) {
  const { loading } = useConnectors();
  const pathname = usePathname();

  const inMcps = pathname.startsWith("/dashboard/connectors/mcps");
  const isRoot = pathname === "/dashboard/connectors";

  const isEditingOrCreate =
    pathname.includes("/new") || pathname.includes("/edit");

  useDashboardHeader(
    {
      title: inMcps ? "MCP Servers" : isRoot ? "Connectors" : "Skills",
      description: isRoot
        ? "Choose a connector type to manage"
        : inMcps
          ? "Manage your Model Context Protocol server connections"
          : "Manage your skills and capabilities",
      actions: !isRoot && !isEditingOrCreate ? (
        <Link href={inMcps ? "/dashboard/connectors/mcps/new" : "/dashboard/connectors/skills/new"}>
          <Button size="sm">
            <Plus className="size-4 mr-2" />
            {inMcps ? "Add Server" : "New Skill"}
          </Button>
        </Link>
      ) : null,
    },
    [pathname, isRoot, isEditingOrCreate]
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      {!isRoot && (
        <ConnectorsNav />
      )}
      <main className="flex-1 overflow-y-auto relative">
        {!isRoot && loading && !inMcps ? (
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <Skeleton className="h-48 rounded-2xl w-full" />
                  <div className="space-y-2 px-1">
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function ConnectorsLayout({ children }) {
  return (
    <ConnectorsProvider>
      <ConnectorsLayoutContent>{children}</ConnectorsLayoutContent>
    </ConnectorsProvider>
  );
}
