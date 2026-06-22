"use client";

import { Cpu, Plus, Menu, Globe, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ConnectorsNav() {
  const pathname = usePathname();

  const inSkills = pathname.startsWith("/dashboard/connectors/skills");
  const inMcps = pathname.startsWith("/dashboard/connectors/mcps");
  const isPublic = pathname === "/dashboard/connectors/skills/public";

  const navContent = (
    <div className="flex h-full flex-col bg-card animate-in fade-in duration-200">
      <div className="p-4 space-y-1">
        {/* Section header */}
        <p className="px-3 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Connectors
        </p>

        {/* Skills link */}
        <Link
          href="/dashboard/connectors/skills"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            inSkills && !isPublic
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <Cpu className="size-4 shrink-0" />
          Skills
        </Link>

        {/* MCP Servers link */}
        <Link
          href="/dashboard/connectors/mcps"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            inMcps
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <Server className="size-4 shrink-0" />
          MCP Servers
        </Link>
      </div>

      {/* Actions */}
      <div className="p-4 pt-2 space-y-2 border-t border-zinc-150/60 dark:border-zinc-900/60 mx-2">
        <Button asChild variant="outline" className="w-full justify-start gap-2 h-9" size="sm">
          <Link href="/dashboard/connectors/skills/new">
            <Plus className="size-4" />
            New Skill
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start gap-2 h-9" size="sm">
          <Link href="/dashboard/connectors/mcps/new">
            <Plus className="size-4" />
            Connect Server
          </Link>
        </Button>
      </div>

      {/* Public Marketplace */}
      <div className="p-4 pt-2 border-t border-zinc-150/60 dark:border-zinc-900/60 mx-2">
        <Link
          href="/dashboard/connectors/skills/public"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            isPublic
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe className="size-4 shrink-0" />
          Public Marketplace
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r sticky top-0 h-[calc(100vh-64px)] overflow-hidden">
        {navContent}
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center p-4 border-b w-full justify-between bg-card">
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-56">
              {navContent}
            </SheetContent>
          </Sheet>
          <span className="ml-4 font-semibold text-sm">Connectors</span>
        </div>
      </div>
    </>
  );
}
