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
import { Skeleton } from "@/components/ui/skeleton";
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
import { getProjectSkills, updateProjectSkill } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function EditSkillPage() {
  const { projectId, skillId } = useParams<{ projectId: string; skillId: string }>();
  const router = useRouter();
  const [form, setForm] = React.useState({ name: "", description: "", instructions: "", isPublic: false, files: [] as { path: string; content: string }[] });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getProjectSkills(projectId)
      .then((res) => {
        const list = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((s: { id: string; _id?: string }) => (s.id ?? s._id) === skillId);
        if (!found) throw new Error("Skill not found");
        setForm({
          name: found.name || "",
          description: found.description || "",
          instructions: found.instructions || "",
          isPublic: !!found.isPublic,
          files: found.files ?? [],
        });
      })
      .catch((err) => setError(errorMessage(err, "Failed to load skill.")))
      .finally(() => setLoading(false));
  }, [projectId, skillId]);

  const handleNameChange = (val: string) => {
    const formatted = val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setForm((p) => ({ ...p, name: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateProjectSkill(projectId, skillId, {
        name: form.name,
        description: form.description,
        instructions: form.instructions,
        isPublic: form.isPublic,
        files: form.files,
      });
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      router.push(`/projects/${projectId}/skills`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save skill."));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[500px] w-full" />
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
            <BreadcrumbPage>Edit {form.name || skillId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <SparkleIcon />
          </span>
          Edit skill
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Update instructions, description, or bundled files.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Skill Configuration</CardTitle>
            <CardDescription>Name is the folder for SKILL.md. Files are bundled alongside.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required maxLength={64} className="font-mono text-sm" />
                  <FieldDescription>2–64, lowercase a-z 0-9 and hyphens. Saved as /{form.name || "..."}/SKILL.md</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required maxLength={1024} rows={2} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="instructions">Instructions (SKILL.md)</FieldLabel>
                  <Textarea id="instructions" value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))} required rows={12} className="font-mono text-sm" />
                  <FieldDescription>10–50000 characters.</FieldDescription>
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
                    {saving ? "Saving…" : "Save skill"}
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
                Files
              </CardTitle>
              <CardDescription>Bundled files are edited in the VS Code explorer at /skills.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>Use the explorer to add, rename, or delete files like references/guide.md. This form saves only name/description/instructions/isPublic.</p>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>For full file editing, open the skill in the VS Code explorer — SKILL.md plus up to 50 files, 200KB each.</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
