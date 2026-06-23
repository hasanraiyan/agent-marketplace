"use client";

import { useState, useMemo } from "react";
import { useConnectors } from "../connectors-context";
import { Cpu, Plus, SearchIcon, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export default function SkillsListPage() {
  const { mySkills, loading } = useConnectors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return mySkills;
    return mySkills.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const desc = (s.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [mySkills, search]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (mySkills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
        <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
          <Cpu className="size-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
          No skills yet
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
          You haven&apos;t created any skills yet. Skills provide specialized
          instructions and capabilities for your agents.
        </p>
        <Link href="/dashboard/connectors/skills/new" className="mt-6">
          <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
            <Plus className="mr-1.5 size-4" />
            Create Your First Skill
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
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-base"
          />
        </InputGroup>
      </div>

      {/* Skill cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((skill) => {
          const id = skill._id || skill.id;
          return (
            <Link
              key={id}
              href={`/dashboard/connectors/skills/${id}`}
              className="group flex flex-col rounded-2xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-5 hover:border-zinc-300 dark:hover:border-zinc-800 transition-all duration-200 active:scale-[0.98]"
            >
              {/* Top: Icon + Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="size-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 dark:from-violet-500/10 dark:to-purple-600/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Cpu className="size-5" />
                </div>
                <Badge
                  variant={skill.isPublic ? "default" : "outline"}
                  className="text-[8px] h-4 px-1.5 uppercase font-bold"
                >
                  {skill.isPublic ? "Public" : "Private"}
                </Badge>
              </div>

              {/* Content */}
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                {skill.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                {skill.description || "No description"}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-150/60 dark:border-zinc-900/60">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {skill.agentCount || 0} agents
                </span>
                <Eye className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
            No skills match
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
