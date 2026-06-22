"use client";

import { useConnectors } from "../../connectors-context";
import { Cpu, Globe, ExternalLink, User, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import Link from "next/link";
import { useState, useMemo } from "react";

const getSkillIcon = (name) => {
  // Return a deterministic gradient color based on skill name
  const colors = [
    "from-violet-500 to-purple-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-blue-600",
    "from-indigo-500 to-violet-600",
    "from-lime-500 to-green-600",
  ];
  const hash = (name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function PublicSkillsPage() {
  const { publicSkills: skills, loading } = useConnectors();
  const [search, setSearch] = useState("");

  const filteredSkills = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.ownerId?.username || "").toLowerCase().includes(q)
    );
  }, [skills, search]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">Public Marketplace</h1>
          <p className="text-xs text-muted-foreground">
            Discover specialized skills created by the community.
          </p>
        </div>
        <div className="hidden sm:block w-64">
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
        </div>
      </header>

      {/* Mobile Search */}
      <div className="sm:hidden px-6 py-3 border-b">
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
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-4 p-5 border rounded-3xl">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-12 w-full rounded-md" />
                <div className="flex items-center justify-between pt-3 border-t">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
            <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
              <Cpu className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
              {search ? "No skills match your search" : "No public skills yet"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
              {search
                ? "Try a different search term to discover more skills."
                : "No skills have been published to the marketplace yet. Check back later for new community contributions."}
            </p>
            {search && (
              <Button
                variant="outline"
                onClick={() => setSearch("")}
                className="mt-6 rounded-full px-6 py-2.5 font-bold transition-all"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSkills.map((skill) => {
              const gradient = getSkillIcon(skill.name);
              return (
                <Link
                  key={skill._id || skill.id}
                  href={`/dashboard/connectors/skills/${skill._id || skill.id}`}
                  className="group flex flex-col p-5 rounded-3xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98]"
                >
                  {/* Top: Icon + Name + Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300`}
                      >
                        <Cpu className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate max-w-[160px] group-hover:text-primary transition-colors">
                          {skill.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[8px] uppercase h-4 px-1 py-0 mt-0.5 border-primary/20 text-primary"
                        >
                          <Globe className="size-2 mr-1" />
                          Public
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-5 flex-1">
                    {skill.description || "No description provided."}
                  </p>

                  {/* Bottom: Author + CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-150/60 dark:border-zinc-900/60">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                      <User className="size-3" />
                      <span className="truncate max-w-[100px]">
                        {skill.ownerId?.username || "Community"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      View Skill
                      <ExternalLink className="size-3" />
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs opacity-100 group-hover:opacity-0 transition-opacity duration-200"
                      asChild
                    >
                      <span>
                        View <ExternalLink className="ml-1 size-3" />
                      </span>
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
