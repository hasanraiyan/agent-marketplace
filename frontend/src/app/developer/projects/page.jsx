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
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
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
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
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
          <Button size="sm" className="rounded-full px-4 font-bold shadow-sm">
            <Plus data-icon="inline-start" />
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
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="rounded-xl border">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b p-4 last:border-0"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full max-w-64" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
        {timeGreeting()}
        {user?.firstName ? `, ${user.firstName}` : ""}
      </h1>

      <Card className="overflow-hidden bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent">
        <CardContent className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-lg">
            <h2 className="font-display text-xl font-semibold md:text-2xl">
              {projects.length === 0
                ? "Ship your first Project"
                : "Build your next integration"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A Project is how an external app consumes Persona&apos;s agent
              infrastructure — its own credentials, Agents, and REST tools.
            </p>
            <Link
              href={developerRoutes.projectNew}
              className="mt-5 inline-block"
            >
              <Button className="rounded-full px-5 font-bold shadow-sm">
                New Project
                <ArrowRight data-icon="inline-end" />
              </Button>
            </Link>
          </div>
          <div
            aria-hidden
            className="flex size-28 shrink-0 items-center justify-center self-center rounded-2xl bg-primary/10 sm:size-32"
          >
            <FolderKanban className="size-12 text-primary sm:size-14" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-muted-foreground">Recents</h3>
          <div className="relative w-full max-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-full pl-8 text-xs"
            />
          </div>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="overflow-hidden rounded-xl border">
            {filteredProjects.map((project) => (
              <Link
                key={project._id}
                href={developerRoutes.project(project._id)}
                className="flex items-center gap-4 border-b p-4 transition-colors last:border-0 hover:bg-accent/50"
              >
                <Avatar className="size-10 rounded-xl">
                  <AvatarFallback
                    className={`rounded-xl text-xs font-bold ${avatarClassName(project.name || project._id)}`}
                  >
                    {initialsFor(project.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {project.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.slug || "—"}
                  </p>
                </div>
                <Badge
                  variant={STATUS_BADGE_VARIANT[project.status] || "outline"}
                  className={`${STATUS_BADGE_CLASSNAME[project.status] || ""} shrink-0`}
                >
                  {project.status}
                </Badge>
                <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {project.createdAt
                    ? new Date(project.createdAt).toLocaleDateString()
                    : "—"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty className="border border-dashed py-14">
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {projects.length === 0
                  ? "No Projects yet"
                  : "No Projects match your search"}
              </EmptyTitle>
              <EmptyDescription>
                {projects.length === 0
                  ? "Create a Project to start consuming Persona's agent infrastructure from your own app."
                  : "Try a different name or slug."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
