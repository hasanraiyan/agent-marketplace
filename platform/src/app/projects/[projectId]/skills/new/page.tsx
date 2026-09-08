"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, SparkleIcon, InfoIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { createProjectSkill } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function NewSkillPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [form, setForm] = React.useState({ name: "", description: "", instructions: "", isPublic: false });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleNameChange = (val: string) => {
    const formatted = val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setForm((p) => ({ ...p, name: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.name.length < 2) {
      setError("Name must be 2-64 lowercase, a-z 0-9 and hyphens.");
      return;
    }
    if (!form.description || form.description.length < 10) {
      setError("Description must be 10-1024 characters.");
      return;
    }
    if (!form.instructions || form.instructions.length < 10) {
      setError("Instructions (SKILL.md) must be 10-50000 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createProjectSkill(projectId, {
        name: form.name,
        description: form.description,
        instructions: form.instructions,
        isPublic: form.isPublic,
        files: [],
      });
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      router.push(`/projects/${projectId}/skills`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create skill."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/skills`} />}>Skills</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New skill</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <SparkleIcon />
          </span>
          <span className="truncate">New skill</span>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Bundle reusable instructions (SKILL.md) plus supporting files. Name is used as folder.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Skill details</CardTitle>
            <CardDescription>Instructions become SKILL.md. Add supporting files after creation in the explorer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. data-analysis"
                    required
                    maxLength={64}
                    className="font-mono text-sm"
                  />
                  <FieldDescription>2–64, lowercase, a-z 0-9 and hyphens. Will be saved as /{form.name || "..."}/SKILL.md</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What does this Skill teach an Agent to do?"
                    required
                    maxLength={1024}
                    rows={3}
                  />
                  <FieldDescription>10–1024 characters. Shown in marketplace and explorer.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="instructions">Instructions (SKILL.md)</FieldLabel>
                  <Textarea
                    id="instructions"
                    value={form.instructions}
                    onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                    placeholder="# Skill Title&#10;&#10;## Overview"
                    required
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <FieldDescription>10–50000 characters. Full content of SKILL.md.</FieldDescription>
                </Field>
                <div className="flex items-center justify-between rounded-none border border-dashed bg-muted/10 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="isPublic" className="text-sm font-medium">
                      Public marketplace
                    </Label>
                    <span className="text-xs text-muted-foreground">Visible to other Projects</span>
                  </div>
                  <Switch id="isPublic" checked={form.isPublic} onCheckedChange={(c) => setForm((p) => ({ ...p, isPublic: !!c }))} />
                </div>
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/skills`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/skills`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create skill"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FolderOpenIcon className="size-4 text-muted-foreground" />
                How skills work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>SKILL.md holds the core workflow. Supporting files like <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">references/guide.md</code> are read on demand.</p>
              <p>Agents load skills via <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">skills: ["skill-name"]</code>.</p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>50 files max, 200KB each, 1MB total</li>
                <li>Path must be relative POSIX, no SKILL.md</li>
                <li>Public skills appear in marketplace</li>
              </ul>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>Use the VS Code-like explorer at /skills to add files after creation — SKILL.md plus references, scripts, assets.</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
