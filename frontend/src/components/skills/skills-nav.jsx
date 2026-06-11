"use client";

import { useState, useMemo } from "react";
import { SearchIcon, Cpu, Globe, Lock, Plus, Menu } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export function SkillsNav({ mySkills, publicSkills }) {
  const params = useParams();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  // mySkills is already fully loaded in context, so filter locally
  // instead of hitting the backend on every keystroke.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return (mySkills || []).filter((skill) =>
      [skill.name, skill.description, skill.instructions].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [search, mySkills]);

  const navContent = (
    <div className="flex h-full flex-col bg-card">
      <div className="p-4 space-y-4">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm"
          />
        </InputGroup>

        <Button asChild variant="outline" className="w-full justify-start gap-2 h-9" size="sm">
          <Link href="/dashboard/skills/new">
            <Plus className="size-4" />
            New Skill
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-4 space-y-6">
          <section>
            <h2 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              My Skills {mySkills?.length > 0 && `(${mySkills.length})`}
            </h2>
            <div className="space-y-1">
              {(searchResults || mySkills).map((skill) => {
                const id = skill._id || skill.id;
                const isActive = params.id === id && !pathname.includes("/public");
                return (
                  <Link
                    key={id}
                    href={`/dashboard/skills/${id}`}
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

          <section>
             <Link
              href="/dashboard/skills/public"
              className={cn(
                "px-3 mb-2 text-xs font-semibold uppercase tracking-wider block hover:text-foreground transition-colors",
                pathname === "/dashboard/skills/public" ? "text-primary" : "text-muted-foreground"
              )}
            >
              Public Marketplace
            </Link>
          </section>
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
      <div className="md:hidden flex items-center p-4 border-b">
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
        <span className="ml-4 font-semibold text-sm">Skills</span>
      </div>
    </>
  );
}
