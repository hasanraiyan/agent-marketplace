"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SparkleIcon, PencilSimpleIcon, TrashIcon, GlobeIcon, LockIcon, FileTextIcon, CalendarIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProjectSkills, deleteProjectSkill, getProjectSkillUsage } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface Skill {
  _id?: string;
  id: string;
  name: string;
  description: string;
  instructions: string;
  isPublic?: boolean;
  files?: { path: string; content: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export default function SkillDetailPage() {
  const { projectId, skillId } = useParams<{ projectId: string; skillId: string }>();
  const router = useRouter();
  const [skill, setSkill] = React.useState<Skill | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [usage, setUsage] = React.useState<{ agentCount: number; agents: { _id: string; name: string }[] } | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getProjectSkills(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Skill[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((s) => (s.id ?? s._id) === skillId);
        if (found) setSkill(found);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getProjectSkillUsage(projectId, skillId)
      .then((r) => {
        if (!cancelled) setUsage(r.data?.data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, skillId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProjectSkill(projectId, skillId);
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      router.push(`/projects/${projectId}/skills`);
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Skill not found</CardTitle>
            <CardDescription>This skill does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/skills`} />}>Skills</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{skill.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <SparkleIcon />
          </span>
          <span className="truncate">{skill.name}</span>
          <Badge variant={skill.isPublic ? "default" : "outline"} className="hidden sm:inline-flex">
            {skill.isPublic ? "Public" : "Private"}
          </Badge>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">{skill.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={skill.isPublic ? "default" : "outline"} className="flex items-center gap-1">
          {skill.isPublic ? <GlobeIcon className="size-3" /> : <LockIcon className="size-3" />}
          {skill.isPublic ? "Public" : "Private"}
        </Badge>
        <span className="text-xs text-muted-foreground">{skill.files ? `${skill.files.length} files` : "0 files"}</span>
        {usage && <span className="text-xs text-muted-foreground">· Used by {usage.agentCount} agents</span>}
        <span className="text-xs text-muted-foreground">· {skill.createdAt ? new Date(skill.createdAt).toLocaleDateString() : "—"}</span>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="size-4" />
                SKILL.md
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-none border bg-muted/20 p-4 font-mono text-xs leading-relaxed">{skill.instructions || "—"}</pre>
            </CardContent>
          </Card>

          {(skill.files ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileTextIcon className="size-4" />
                  Bundled Files ({skill.files?.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border">
                {skill.files?.map((f) => (
                  <div key={f.path} className="flex flex-col gap-1 py-3">
                    <span className="font-mono text-xs font-medium">{f.path}</span>
                    <pre className="whitespace-pre-wrap rounded-none border bg-muted/10 p-2 font-mono text-[11px]">{f.content.slice(0, 800)}{f.content.length > 800 ? "…" : ""}</pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button render={<Link href={`/projects/${projectId}/skills/${skillId}/edit`} />} className="w-full">
                <PencilSimpleIcon data-icon="inline-start" />
                Edit skill
              </Button>
              <Button variant="outline" render={<Link href={`/projects/${projectId}/skills`} />} className="w-full">
                Back to explorer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarIcon className="size-4 text-muted-foreground" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono text-[11px]">{skill.createdAt ? new Date(skill.createdAt).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Files</span>
                <span>{skill.files?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used by</span>
                <span>{usage ? `${usage.agentCount} agents` : "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon className="size-4" />
                Danger zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white" onClick={() => setDeleteOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete skill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill “{skill.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the skill from any agents using it. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
