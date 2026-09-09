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
import {
  Plus,
  Search,
  FolderKanban,
  ArrowRight,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DeveloperOnboardingHub } from "@/components/developer/developer-onboarding-hub";

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
  const [showGuide, setShowGuide] = useState(false);

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

  // First-time developer onboarding state: When the user has zero projects,
  // show the rich Developer Onboarding Hub with interactive steps, code tabs,
  // blueprints, and instant project launch.
  if (projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-8">
        <DeveloperOnboardingHub
          onProjectCreated={(newProj) => {
            setProjects((prev) => [newProj, ...prev]);
          }}
        />
      </div>
    );
  }

  // Active developer state: When user has projects
  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {timeGreeting()}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your external application workspaces, credentials, and agent runtimes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide((prev) => !prev)}
            className="gap-1.5 rounded-full text-xs font-semibold"
          >
            <BookOpen className="size-3.5" />
            {showGuide ? "Hide Quickstart" : "Developer Quickstart"}
            {showGuide ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>

          <Link href={developerRoutes.projectNew}>
            <Button size="sm" className="rounded-full bg-[#1E60FF] px-4 font-bold text-white shadow-sm hover:bg-[#154ed0]">
              <Plus className="mr-1 size-3.5" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Collapsible Onboarding Hub & SDK Guide */}
      {showGuide && (
        <div className="rounded-3xl border border-primary/20 bg-muted/20 p-6">
          <DeveloperOnboardingHub
            onProjectCreated={(newProj) => {
              setProjects((prev) => [newProj, ...prev]);
              setShowGuide(false);
            }}
          />
        </div>
      )}

      {/* Projects List Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">Your Projects</h2>
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {projects.length}
            </Badge>
          </div>

          <div className="relative w-full max-w-64">
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
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
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
                  <p className="truncate text-sm font-semibold text-foreground">
                    {project.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.slug || project._id}
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
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <Empty className="border border-dashed py-14">
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No Projects match your search</EmptyTitle>
              <EmptyDescription>
                Try searching with a different project name or slug.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
