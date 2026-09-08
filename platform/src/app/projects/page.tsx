"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FoldersIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjects } from "@/lib/api/projects";
import { getCached, setCached, dedupedFetch, cacheKey } from "@/lib/cache";

interface Project {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  status?: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[] | null>(null);

  React.useEffect(() => {
    const key = cacheKey.projects();
    const cached = getCached<Project[]>(key);
    if (cached && cached.length > 0) {
      const firstId = (cached[0] as Project)._id || (cached[0] as Project).id;
      if (firstId) {
        router.replace(`/projects/${firstId}`);
        return;
      }
    }
    dedupedFetch(key, () => getProjects().then((res) => (res.data?.data || []) as Project[]))
      .then((data) => {
        setCached(key, data);
        if (data.length > 0) {
          const firstId = (data[0] as Project)._id || (data[0] as Project).id;
          if (firstId) {
            router.replace(`/projects/${firstId}`);
            return;
          }
        }
        setProjects(data);
      })
      .catch(() => setProjects([]));
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Button size="sm" render={<Link href="/projects/new" />}>
          <PlusIcon />
          New project
        </Button>
      </div>

      {projects === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FoldersIcon />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Create a project to start building Agents.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" render={<Link href="/projects/new" />}>
              <PlusIcon />
              New project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <Link key={project._id} href={`/projects/${project._id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{project.name}</span>
                    {project.slug && (
                      <span className="text-xs text-muted-foreground">{project.slug}</span>
                    )}
                  </div>
                  {project.status && project.status !== "ACTIVE" && (
                    <span className="text-xs text-muted-foreground">{project.status}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
