"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon, InfoIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { createProjectKnowledge, getProjectProviders } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function NewKnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    providerId: "",
    embeddingModel: "text-embedding-3-small",
    chunkSize: "",
    chunkOverlap: "",
    topK: "",
  });
  const [providers, setProviders] = React.useState<{ id: string; _id?: string; label: string; isDefault?: boolean }[]>([]);
  const [loadingProviders, setLoadingProviders] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  React.useEffect(() => {
    getProjectProviders(projectId)
      .then((res) => {
        const list = res.data?.data ?? res.data?.data?.items ?? [];
        setProviders(list);
        const def = list.find((p: { isDefault?: boolean }) => p.isDefault) || list[0];
        if (def) setFormData((prev) => ({ ...prev, providerId: def.id ?? def._id ?? "" }));
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!formData.providerId) {
      setError("Please configure a Provider first — knowledge bases need a provider for embeddings.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        providerId: formData.providerId,
        embeddingModel: formData.embeddingModel || undefined,
      };
      if (formData.chunkSize) data.chunkSize = Number(formData.chunkSize);
      if (formData.chunkOverlap) data.chunkOverlap = Number(formData.chunkOverlap);
      if (formData.topK) data.topK = Number(formData.topK);
      await createProjectKnowledge(projectId, data);
      deleteCachedByPrefix(cacheKey.resource(projectId, "knowledge"));
      router.push(`/projects/${projectId}/knowledge`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create knowledge base."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/knowledge`} />}>Knowledge</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New knowledge base</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <BookOpenIcon />
          </span>
          <span className="truncate">New knowledge base</span>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Create a knowledge base, then upload documents — your Agents will search them semantically.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge base details</CardTitle>
            <CardDescription>Provider and embedding model are fixed at creation. Chunk settings can be tuned later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" placeholder="e.g. Company Handbook" value={formData.name} onChange={handleChange} required maxLength={200} />
                  <FieldDescription>1–200 characters.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" placeholder="Optional — helps decide when to search this base" value={formData.description} onChange={handleChange} maxLength={1000} rows={2} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="providerId">Provider</FieldLabel>
                  {loadingProviders ? (
                    <Skeleton className="h-8 w-full" />
                  ) : providers.length === 0 ? (
                    <Alert>
                      <ShieldCheckIcon />
                      <AlertTitle>No providers</AlertTitle>
                      <AlertDescription>
                        You need to configure an AI provider first.{" "}
                        <Link href={`/projects/${projectId}/providers/new`} className="underline">
                          Create a provider
                        </Link>
                        .
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={formData.providerId} onValueChange={(v: string | null) => setFormData((p) => ({ ...p, providerId: v ?? "" }))} required>
                      <SelectTrigger id="providerId" className="w-full">
                        {formData.providerId ? (
                          <span className="flex-1 truncate text-left">
                            {providers.find((p) => (p.id ?? p._id) === formData.providerId)?.label ?? formData.providerId}
                            {providers.find((p) => (p.id ?? p._id) === formData.providerId)?.isDefault ? " — Default" : ""}
                          </span>
                        ) : (
                          <SelectValue placeholder="Select a provider" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id ?? p._id} value={p.id ?? p._id ?? ""}>
                            {p.label}
                            {p.isDefault ? " — Default" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FieldDescription>Used to generate embeddings for your documents.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="embeddingModel">Embedding Model</FieldLabel>
                  <Select value={formData.embeddingModel} onValueChange={(v: string | null) => setFormData((p) => ({ ...p, embeddingModel: v ?? "text-embedding-3-small" }))}>
                    <SelectTrigger id="embeddingModel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text-embedding-3-small">text-embedding-3-small (1536) — Recommended</SelectItem>
                      <SelectItem value="text-embedding-3-large">text-embedding-3-large (3072)</SelectItem>
                      <SelectItem value="text-embedding-ada-002">text-embedding-ada-002 (1536)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide" : "Configure"} custom chunk settings
                </Button>

                {showAdvanced && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="chunkSize">Chunk Size</FieldLabel>
                      <Input id="chunkSize" name="chunkSize" type="number" min={1} placeholder="800" value={formData.chunkSize} onChange={handleChange} />
                      <FieldDescription>Default 800</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="chunkOverlap">Chunk Overlap</FieldLabel>
                      <Input id="chunkOverlap" name="chunkOverlap" type="number" min={0} placeholder="100" value={formData.chunkOverlap} onChange={handleChange} />
                      <FieldDescription>Default 100</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="topK">Top K</FieldLabel>
                      <Input id="topK" name="topK" type="number" min={1} max={50} placeholder="5" value={formData.topK} onChange={handleChange} />
                      <FieldDescription>Default 5, max 50</FieldDescription>
                    </Field>
                  </div>
                )}
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/knowledge`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/knowledge`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !formData.name.trim() || !formData.providerId}>
                    {saving ? "Creating…" : "Create knowledge base"}
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
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                How knowledge works
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>Upload PDF, TXT, MD, CSV, JSON (up to 20 MB each, 10 per batch). They are chunked, embedded, and indexed in Qdrant for semantic search.</p>
              <p>Agents use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">knowledgeBases</code> to search — topK controls how many chunks are returned.</p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>Provider + embedding model are fixed at creation.</li>
                <li>Chunk size/overlap tune retrieval granularity.</li>
                <li>Documents can be deleted individually — their embeddings are removed from Qdrant.</li>
              </ul>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>Start with defaults (800/100/5) — tune only if retrieval feels too coarse or too fragmented.</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
