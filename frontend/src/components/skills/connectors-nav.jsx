"use client";

import { useState, useMemo } from "react";
import {
  SearchIcon,
  Cpu,
  Plus,
  Menu,
  Search,
  Folder,
  Database,
  MessageSquare,
  Server
} from "lucide-react";

const Github = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useConnectors } from "@/app/dashboard/connectors/connectors-context";

export function ConnectorsNav({ mySkills, publicSkills }) {
  const params = useParams();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const {
    activeTab,
    mcps,
  } = useConnectors();

  // Filter skills or MCPs locally
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    if (activeTab === "skills") {
      return (mySkills || []).filter((skill) =>
        [skill.name, skill.description, skill.instructions].some((field) =>
          field?.toLowerCase().includes(q)
        )
      );
    } else {
      return (mcps || []).filter((mcp) =>
        [mcp.name, mcp.description, mcp.url].some((field) =>
          field?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, mySkills, mcps, activeTab]);

  const navContent = (
    <div className="flex h-full flex-col bg-card animate-in fade-in duration-200">
      <div className="p-4 space-y-4">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={activeTab === "skills" ? "Search skills..." : "Search servers..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm"
          />
        </InputGroup>

        {activeTab === "skills" ? (
          <Button asChild variant="outline" className="w-full justify-start gap-2 h-9" size="sm">
            <Link href="/dashboard/connectors/skills/new">
              <Plus className="size-4" />
              New Skill
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full justify-start gap-2 h-9" size="sm">
            <Link href="/dashboard/connectors/mcps/new">
              <Plus className="size-4" />
              Connect Server
            </Link>
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-4 space-y-6">
          {activeTab === "skills" ? (
            <section>
              <h2 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Skills {mySkills?.length > 0 && `(${mySkills.length})`}
              </h2>
              <div className="space-y-1">
                {(searchResults || mySkills).map((skill) => {
                  const id = skill._id || skill.id;
                  const isActive = params.id === id && !pathname.includes("/public") && !pathname.includes("/new") && !pathname.includes("/edit");
                  return (
                    <Link
                      key={id}
                      href={`/dashboard/connectors/skills/${id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Cpu className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate flex-1">{skill.name}</span>
                      <Badge variant={skill.isPublic ? "default" : "outline"} className="text-[8px] h-4 px-1 uppercase shrink-0">
                        {skill.isPublic ? "Public" : "Private"}
                      </Badge>
                    </Link>
                  );
                })}
                {searchResults?.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground italic">No matches found</p>
                )}
              </div>
            </section>
          ) : (
            <section>
              <h2 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                MCP Servers {mcps?.length > 0 && `(${mcps.length})`}
              </h2>
              <div className="space-y-1">
                {(searchResults || mcps).map((mcp) => {
                  const id = mcp._id;
                  const isActive = params.id === id && pathname.startsWith("/dashboard/connectors/mcps");
                  return (
                    <Link
                      key={id}
                      href={`/dashboard/connectors/mcps/${id}`}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                        isActive
                          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Server className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate flex-1">{mcp.name}</span>
                      <span className={cn(
                        "size-2 rounded-full shrink-0",
                        mcp.isEnabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                      )} />
                    </Link>
                  );
                })}
                {searchResults?.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground italic">No matches found</p>
                )}
              </div>
            </section>
          )}

          {activeTab === "skills" && (
            <section>
              <Link
                href="/dashboard/connectors/skills/public"
                className={cn(
                  "px-3 mb-2 text-xs font-semibold uppercase tracking-wider block hover:text-foreground transition-colors",
                  pathname === "/dashboard/connectors/skills/public" ? "text-primary" : "text-muted-foreground"
                )}
              >
                Public Marketplace
              </Link>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r sticky top-0 h-[calc(100vh-64px)] overflow-hidden">
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
            <SheetContent side="left" className="p-0 w-72">
              {navContent}
            </SheetContent>
          </Sheet>
          <span className="ml-4 font-semibold text-sm">Connectors</span>
        </div>
      </div>
    </>
  );
}
