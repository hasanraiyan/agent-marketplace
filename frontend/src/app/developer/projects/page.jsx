"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { getProjects } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Plus } from "lucide-react";

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

export default function ProjectsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useDashboardHeader(
    {
      title: "Projects",
      description:
        "Developer Platform Projects you administer — external consumers of Persona's agent infrastructure.",
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="rounded-md border">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b p-4 last:border-0"
            >
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {projects.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project._id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={developerRoutes.project(project._id)}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {project.slug || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        STATUS_BADGE_VARIANT[project.status] || "outline"
                      }
                      className={STATUS_BADGE_CLASSNAME[project.status]}
                    >
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {project.createdAt
                      ? new Date(project.createdAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border-dashed">
          <EmptyHeader>
            <EmptyTitle>No Projects yet</EmptyTitle>
            <EmptyDescription>
              Create a Project to start consuming Persona&apos;s agent
              infrastructure from your own app.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href={developerRoutes.projectNew}>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create your first Project
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
