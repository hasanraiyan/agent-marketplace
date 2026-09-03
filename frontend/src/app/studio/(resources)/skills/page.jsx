"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useState, useMemo } from "react";
import { useConnectors } from "@/components/connectors/connectors-context";
import {
  Cpu,
  Plus,
  SearchIcon,
  Eye,
  Globe,
  Link2,
  Lock,
  Play,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillCover, skillCategoryLabel } from "@/components/skills/skill-cover";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const VISIBILITY_META = {
  public: { label: "Public", icon: Globe },
  unlisted: { label: "Unlisted", icon: Link2 },
  private: { label: "Private", icon: Lock },
};

function skillVisibility(skill) {
  const v = skill?.visibility;
  if (v === "public" || v === "unlisted" || v === "private") return v;
  return skill?.isPublic ? "public" : "private";
}

function VisibilityBadge({ visibility, className }) {
  const meta = VISIBILITY_META[visibility] || VISIBILITY_META.private;
  const Icon = meta.icon;
  return (
    <Badge
      variant={visibility === "public" ? "default" : "outline"}
      className={cn(
        "text-[9px] h-4.5 px-1.5 uppercase font-bold gap-1",
        visibility !== "public" && "bg-background/80 backdrop-blur",
        className,
      )}
    >
      <Icon className="size-2.5!" />
      {meta.label}
    </Badge>
  );
}

export default function SkillsListPage() {
  const { mySkills, loading } = useConnectors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return mySkills;
    return mySkills.filter((s) => {
      const haystack = [
        s.name,
        s.title,
        s.hook,
        s.description,
        ...(Array.isArray(s.tags) ? s.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mySkills, search]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
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
        <Link href={studioRoutes.skillNew} className="mt-6">
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
          const visibility = skillVisibility(skill);
          const usageCount = Number(skill.usageCount) || 0;
          return (
            <Link
              key={id}
              href={studioRoutes.skill(id)}
              className="group flex flex-col rounded-2xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-3 hover:border-zinc-300 dark:hover:border-zinc-800 transition-all duration-200 active:scale-[0.98]"
            >
              {/* Cover */}
              <div className="relative">
                <SkillCover
                  skill={skill}
                  persona={skill.persona}
                  size="sm"
                  className="aspect-video w-full rounded-xl"
                />
                <VisibilityBadge
                  visibility={visibility}
                  className="absolute top-2 left-2"
                />
              </div>

              {/* Content */}
              <div className="px-2 pt-4 flex-1 flex flex-col">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {skill.title || skill.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                  {skill.hook || skill.description || "No description"}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-zinc-150/60 dark:border-zinc-900/60">
                  <div className="flex items-center gap-2 min-w-0 text-[10px] font-medium text-muted-foreground">
                    <span className="truncate">
                      {skillCategoryLabel(skill.category)}
                    </span>
                    {usageCount > 0 && (
                      <span className="inline-flex items-center gap-1 shrink-0 before:content-['·'] before:text-zinc-300 dark:before:text-zinc-700">
                        <Play className="size-2.5" />
                        {usageCount.toLocaleString()}{" "}
                        {usageCount === 1 ? "play" : "plays"}
                      </span>
                    )}
                  </div>
                  <Eye className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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
