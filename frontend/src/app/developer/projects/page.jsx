"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { getProjects } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { useOnboardingSection } from "@/hooks/use-onboarding-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FolderKanban, ArrowRight } from "lucide-react";

// Badge has no real "success" variant (only default/secondary/destructive/
// outline/ghost/link) — mirrors the existing workaround in
// studio/(resources)/providers/page.jsx: pass an explicit className for the
// one status that needs a green look.
const STATUS_BADGE_CLASSNAME = {
  ACTIVE:
    "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};
const STATUS_BADGE_VARIANT = {
  ACTIVE: "outline",
  SUSPENDED: "secondary",
  DELETING: "destructive",
  DELETED: "outline",
};

// Cycled per row so a project list reads as distinct at a glance, the same
// way Sarvam/Vapi-style dashboards color each row's avatar.
const AVATAR_PALETTE = [
  "bg-[#1E60FF] text-white",
  "bg-violet-500 text-white",
  "bg-amber-500 text-white",
  "bg-emerald-500 text-white",
  "bg-rose-500 text-white",
  "bg-cyan-500 text-white",
];

function avatarClassName(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(name) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "P"
  );
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function ProjectsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  useOnboardingSection("developer");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useDashboardHeader(
    {
      title: "Projects",
      actions: (
        <Link href={developerRoutes.projectNew}>
          <Button
            size="sm"
            className="rounded-full px-4 font-bold !bg-[#1E60FF] !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]"
          >
            <Plus className="mr-1.5 size-4" />
            New Project
          </Button>
        </Link>
      ),
    },
    [],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getProjects();
        if (res.data?.success) {
          setProjects(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to fetch Projects.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q),
    );
  }, [projects, search]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6 lg:p-8">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="rounded-2xl border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full max-w-64" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-6 lg:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-3xl">
        {timeGreeting()}
        {user?.firstName ? `, ${user.firstName}` : ""}
      </h1>

      {/* Hero — persistent promo card, mirrors the "ready to deploy" banner
          pattern instead of only surfacing a CTA once the list is empty. */}
      <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-zinc-100 bg-gradient-to-br from-[#1E60FF]/[0.06] via-transparent to-transparent p-6 dark:border-slate-800/60 sm:flex-row sm:items-center sm:p-8">
        <div className="relative z-10 max-w-lg">
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-white md:text-2xl">
            {projects.length === 0
              ? "Ship your first Project"
              : "Build your next integration"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
            A Project is how an external app consumes Persona&apos;s agent
            infrastructure — its own credentials, Agents, and REST tools.
          </p>
          <Link href={developerRoutes.projectNew} className="mt-5 inline-block">
            <Button className="rounded-full !bg-zinc-900 px-5 font-bold !text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:!bg-zinc-800 active:scale-[0.98] dark:!bg-white dark:!text-zinc-900 dark:hover:!bg-zinc-200">
              New Project
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </Link>
        </div>
        <div
          aria-hidden
          className="relative z-0 flex size-28 shrink-0 items-center justify-center self-center rounded-3xl bg-[#1E60FF]/10 sm:size-32"
        >
          <FolderKanban className="size-12 text-[#1E60FF] sm:size-14" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-zinc-500 dark:text-slate-400">
            Recents
          </h3>
          <div className="relative w-full max-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-full pl-8 text-xs"
            />
          </div>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-slate-800/60">
            {filteredProjects.map((project) => (
              <Link
                key={project._id}
                href={developerRoutes.project(project._id)}
                className="flex items-center gap-4 border-b border-zinc-100 p-4 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-slate-800/60 dark:hover:bg-slate-900/40"
              >
                <Avatar className="size-10 rounded-xl">
                  <AvatarFallback
                    className={`rounded-xl text-xs font-bold ${avatarClassName(project.name || project._id)}`}
                  >
                    {initialsFor(project.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    {project.name}
                  </p>
                  <p className="truncate text-xs text-zinc-450 dark:text-slate-500">
                    {project.slug || "—"}
                  </p>
                </div>
                <Badge
                  variant={STATUS_BADGE_VARIANT[project.status] || "outline"}
                  className={`${STATUS_BADGE_CLASSNAME[project.status] || ""} shrink-0`}
                >
                  {project.status}
                </Badge>
                <span className="hidden w-24 shrink-0 text-right text-xs text-zinc-450 dark:text-slate-500 sm:block">
                  {project.createdAt
                    ? new Date(project.createdAt).toLocaleDateString()
                    : "—"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-14 text-center dark:border-slate-800">
            <FolderKanban className="size-8 text-zinc-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-slate-300">
              {projects.length === 0
                ? "No Projects yet"
                : "No Projects match your search"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-zinc-450 dark:text-slate-500">
              {projects.length === 0
                ? "Create a Project to start consuming Persona's agent infrastructure from your own app."
                : "Try a different name or slug."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
