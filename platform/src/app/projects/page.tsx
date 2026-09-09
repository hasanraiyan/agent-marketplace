"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react";
import { AppIcon } from "@/components/layout/app-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createProject, getProjects } from "@/lib/api/projects";
import { getCached, setCached, dedupedFetch, cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface Project {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  status?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

/**
 * First-run screen: welcomes a brand-new account straight into naming its
 * first Project, instead of a bare "no projects" empty state. Creating here
 * routes into /projects/[id], which redirects to the Playground — where the
 * Agent Architect is the default surface, so this is really step one of a
 * two-step onboarding (name the workspace, then describe the agent).
 */
function FirstProjectScreen() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProject({ name: name.trim() });
      const project = res.data?.data;
      deleteCachedByPrefix(cacheKey.projects());
      router.push(`/projects/${project._id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create project."));
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />

      <header className="flex items-center gap-2.5 px-6 py-5">
        <AppIcon className="size-6" />
        <span className="text-sm font-semibold tracking-tight">Persona</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex w-full max-w-md flex-col gap-8 motion-safe:duration-500">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
              Set up your first project
            </h1>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              A project is your workspace on Persona — its own agents, tools, knowledge, and
              credentials. Name it, and we&apos;ll take you straight into building.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="project-name">Project name</FieldLabel>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Support Bot, Research Team"
                autoFocus
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Button type="submit" size="lg" disabled={submitting || !name.trim()} className="w-fit">
              {submitting ? "Creating…" : "Create project"}
              {!submitting && <ArrowRightIcon data-icon="inline-end" />}
            </Button>
          </form>

          <p className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
            Next, tell the Agent Architect what you want to build — it creates the agent for
            you, wired to whatever tools and knowledge it needs.
          </p>
        </div>
      </main>
    </div>
  );
}

function ProjectsLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-5">
      <div className="flex items-center gap-2.5">
        <AppIcon className="size-6" />
        <span className="text-sm font-semibold tracking-tight">Persona</span>
      </div>
      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
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

  if (projects === null) {
    return <ProjectsLoadingScreen />;
  }

  if (projects.length === 0) {
    return <FirstProjectScreen />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Button size="sm" render={<Link href="/projects/new" />}>
          <PlusIcon />
          New project
        </Button>
      </div>

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
    </div>
  );
}
