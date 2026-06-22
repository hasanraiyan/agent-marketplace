"use client";

import { useState, useMemo } from "react";
import { useConnectors } from "../connectors-context";
import { Server, Plus, Power, PowerOff, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export default function McpsListPage() {
  const { mcps, loadingMcps } = useConnectors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return mcps;
    return mcps.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const desc = (m.description || "").toLowerCase();
      const url = (m.url || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || url.includes(q);
    });
  }, [mcps, search]);

  if (loadingMcps) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
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
    <div className="p-6 space-y-6">
      {/* Mobile Search */}
      <div className="md:hidden">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search MCP servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-base"
          />
        </InputGroup>
      </div>

      {/* MCP cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((mcp) => {
          const id = mcp._id || mcp.id;
          return (
            <Link
              key={id}
              href={`/dashboard/connectors/mcps/${id}`}
              className="group flex flex-col rounded-2xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-5 hover:border-primary/20 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              {/* Top: Icon + Status Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="size-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 dark:from-sky-500/10 dark:to-blue-600/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Server className="size-5" />
                </div>
                <Badge
                  variant={mcp.isEnabled ? "default" : "secondary"}
                  className="text-[8px] h-4 px-1.5 uppercase font-bold"
                >
                  {mcp.isEnabled ? "Active" : "Disabled"}
                </Badge>
              </div>

              {/* Content */}
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-primary transition-colors flex-1 min-w-0 truncate">
                  {mcp.name}
                </h3>
                {mcp.isEnabled ? (
                  <Power className="size-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <PowerOff className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                {mcp.description || mcp.url || "No description or URL"}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-150/60 dark:border-zinc-900/60">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {mcp.tools?.length || 0} tools
                </span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded shrink-0">
                  {mcp.transport || "http"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* No search results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-lg mx-auto">
          <div className="size-12 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4 text-zinc-400 dark:text-zinc-600">
            <SearchIcon className="size-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-150">
            No MCP servers match
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Try a different search term
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearch("")}
            className="mt-4 rounded-full font-bold"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
