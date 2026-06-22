"use client";

import { useConnectors } from "../connectors-context";
import { Server, Plus, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function McpsListPage() {
  const { mcps, loadingMcps } = useConnectors();

  if (loadingMcps) {
    return (
      <div className="p-6">
        <div className="space-y-3 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border rounded-2xl"
            >
              <Skeleton className="size-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3 rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mcps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
        <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
          <Server className="size-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
          No MCP servers configured
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
          You haven&apos;t connected any remote MCP servers yet. Add one to
          extend your agents&apos; capabilities with external tools and APIs.
        </p>
        <Link href="/dashboard/connectors/mcps/new" className="mt-6">
          <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
            <Plus className="mr-1.5 size-4" />
            Add Your First Server
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-3 max-w-4xl">
        {mcps.map((mcp) => {
          const id = mcp._id;
          return (
            <Link
              key={id}
              href={`/dashboard/connectors/mcps/${id}`}
              className="group flex items-center gap-4 p-4 rounded-2xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card hover:border-primary/20 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              {/* Icon */}
              <div className="size-12 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 dark:from-sky-500/10 dark:to-blue-600/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <Server className="size-6" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary transition-colors">
                    {mcp.name}
                  </h3>
                  {mcp.isEnabled ? (
                    <Power className="size-3 text-emerald-500 shrink-0" />
                  ) : (
                    <PowerOff className="size-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {mcp.url || mcp.description || "No URL configured"}
                </p>
              </div>

              {/* Status */}
              <Badge
                variant={mcp.isEnabled ? "default" : "secondary"}
                className="rounded-full text-[10px] h-5 px-2.5 font-bold shrink-0"
              >
                {mcp.isEnabled ? "Active" : "Disabled"}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
