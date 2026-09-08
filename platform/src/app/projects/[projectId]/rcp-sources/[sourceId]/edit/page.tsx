"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockIcon,
  CopyIcon,
  FingerprintIcon,
  InfoIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WarningCircleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  getProjectRcpSources,
  updateProjectRcpSource,
  deleteProjectRcpSource,
  getProjectRcpSourceUsage,
  testProjectRcpSource,
  getProjectSecrets,
} from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface Secret {
  _id?: string;
  id: string;
  label: string;
}

interface RcpTool {
  name: string;
  description?: string;
  method?: string;
  url?: string;
}

interface RcpSource {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  url: string;
  authType?: string;
  secretRef?: string | null;
  isEnabled?: boolean;
  tools?: RcpTool[];
  lastTestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function EditRcpSourcePage() {
  const { projectId, sourceId } = useParams<{ projectId: string; sourceId: string }>();
  const router = useRouter();
  const [source, setSource] = React.useState<RcpSource | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    url: "",
    authType: "none",
    secretRef: "",
    isEnabled: true,
  });
  const [secrets, setSecrets] = React.useState<Secret[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [usage, setUsage] = React.useState<{ agentCount: number; agents: { _id: string; name: string }[] } | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    getProjectSecrets(projectId)
      .then((res) => setSecrets(res.data?.data ?? []))
      .catch(() => setSecrets([]));
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectRcpSources(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: RcpSource[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((s) => (s.id ?? s._id) === sourceId);
        if (!found) {
          setLoadError("RCP source not found.");
        } else {
          setSource(found);
          setFormData({
            name: found.name || "",
            description: found.description || "",
            url: found.url || "",
            authType: found.authType || "none",
            secretRef: found.secretRef || "",
            isEnabled: found.isEnabled !== false,
          });
          getProjectRcpSourceUsage(projectId, found.id ?? (found._id as string))
            .then((r) => {
              if (!cancelled) setUsage(r.data?.data ?? null);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load RCP source."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, sourceId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTest = async () => {
    if (!source) return;
    setTesting(true);
    setTestResult(null);
    try {
      const targetId = source.id ?? source._id ?? sourceId;
      const res = await testProjectRcpSource(projectId, targetId);
      const tools: RcpTool[] | undefined = res.data?.data?.tools;
      const msg = res.data?.data?.message || res.data?.message || (tools ? `Found ${tools.length} tool(s).` : "Connection successful.");
      setTestResult(msg);
      if (tools) setSource((prev) => (prev ? { ...prev, tools, lastTestedAt: new Date().toISOString() } : prev));
    } catch (err) {
      setTestResult(errorMessage(err, "Connection failed."));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data: Record<string, unknown> = { ...formData };
      if (data.authType !== "header") data.secretRef = null;
      else if (!data.secretRef) {
        setSaveError("Select a secret to send as the auth header.");
        setSaving(false);
        return;
      }
      const targetId = source.id ?? source._id ?? sourceId;
      await updateProjectRcpSource(projectId, targetId, data);
      deleteCachedByPrefix(cacheKey.resource(projectId, "rcp-sources"));
      router.push(`/projects/${projectId}/rcp-sources`);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save RCP source."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!source) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = source.id ?? source._id ?? sourceId;
      await deleteProjectRcpSource(projectId, targetId);
      deleteCachedByPrefix(cacheKey.resource(projectId, "rcp-sources"));
      router.push(`/projects/${projectId}/rcp-sources`);
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete RCP source. It may still be used by agents."));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[500px] w-full" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !source) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/rcp-sources`} />}>RCP Sources</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>RCP source not found</CardTitle>
            <CardDescription>{loadError ?? "This source does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/rcp-sources`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to RCP sources
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.agentCount ?? 0) > 0;
  const sourceIdDisplay = source.id ?? source._id ?? sourceId;

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/rcp-sources`} />}>RCP Sources</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{source.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <WrenchIcon />
          </span>
          <span className="truncate">Edit RCP source</span>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Update the manifest URL, auth, or enabled state.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Source configuration</CardTitle>
            <CardDescription>Test the connection after saving to discover the tools this source exposes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} required minLength={2} maxLength={100} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} maxLength={500} rows={2} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="url">Manifest URL</FieldLabel>
                  <Input id="url" name="url" type="url" value={formData.url} onChange={handleChange} required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="authType">Authentication</FieldLabel>
                  <Select
                    value={formData.authType}
                    onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, authType: value ?? "none" }))}
                  >
                    <SelectTrigger id="authType">
                      <SelectValue placeholder="Select auth type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="header">Header (secret)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formData.authType === "header" && (
                  secrets && secrets.length === 0 ? (
                    <Alert>
                      <InfoIcon />
                      <AlertTitle>No secrets yet</AlertTitle>
                      <AlertDescription>
                        Create a secret first, then attach it here.{" "}
                        <Link href={`/projects/${projectId}/secrets/new`} className="underline underline-offset-4">
                          New secret
                        </Link>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="secretRef">Secret</FieldLabel>
                      <Select
                        value={formData.secretRef}
                        onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, secretRef: value ?? "" }))}
                      >
                        <SelectTrigger id="secretRef">
                          <SelectValue placeholder={secrets === null ? "Loading…" : "Select a secret"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(secrets ?? []).map((s) => (
                            <SelectItem key={s.id ?? s._id} value={(s.id ?? s._id) as string}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>Sent as an auth header on every request to this source.</FieldDescription>
                    </Field>
                  )
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isEnabled: !!checked }))}
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="isEnabled" className="text-sm font-medium leading-none">
                      Enabled
                    </label>
                    <p className="text-xs text-muted-foreground">Disabled sources are hidden from Agents without deleting them.</p>
                  </div>
                </div>
              </FieldGroup>

              {saveError && <FieldError>{saveError}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/rcp-sources`} />}>
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test connection"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/rcp-sources`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Update source"}
                  </Button>
                </div>
              </div>
              {testResult && <p className="text-xs text-muted-foreground">{testResult}</p>}
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FingerprintIcon className="size-4 text-muted-foreground" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 divide-y divide-border text-xs">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FingerprintIcon className="size-3.5" />
                  ID
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="max-w-[140px] truncate font-mono text-[11px] sm:max-w-[180px]">{sourceIdDisplay}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(sourceIdDisplay);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <CopyIcon data-icon="inline-start" className={copied ? "text-primary" : undefined} />
                  </Button>
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Created
                </span>
                <span className="font-mono text-[11px]">{source.createdAt ? new Date(source.createdAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Last tested</span>
                <span className="font-mono text-[11px]">{source.lastTestedAt ? new Date(source.lastTestedAt).toLocaleString() : "Never"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={formData.isEnabled ? "default" : "outline"}>{formData.isEnabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            </CardContent>
          </Card>

          {source.tools && source.tools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <WrenchIcon className="size-4 text-muted-foreground" />
                  Discovered tools ({source.tools.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border text-xs">
                {source.tools.map((t) => (
                  <div key={t.name} className="flex flex-col gap-0.5 py-2">
                    <span className="font-mono font-medium">{t.name}</span>
                    {t.description && <span className="text-muted-foreground">{t.description}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PlugsConnectedIcon className="size-4 text-muted-foreground" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {usage ? (
                isUsed ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">Used by {usage.agentCount} agent(s):</p>
                    <ul className="flex list-disc flex-col gap-1 pl-4">
                      {usage.agents.map((a) => (
                        <li key={a._id} className="truncate">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not used by any agent.</p>
                )
              ) : (
                <p className="text-muted-foreground">Loading usage…</p>
              )}
            </CardContent>
          </Card>

          {isUsed && usage && (
            <Alert>
              <WarningCircleIcon />
              <AlertTitle>Used by {usage.agentCount} agent(s)</AlertTitle>
              <AlertDescription>{usage.agents.map((a) => a.name).join(", ")}. Update those agents before deleting.</AlertDescription>
            </Alert>
          )}

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon />
                Danger zone
              </CardTitle>
              <CardDescription>Deleting is blocked while agents still use this source.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && <FieldError>{deleteError}</FieldError>}
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white" onClick={() => setDeleteOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete source
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RCP source "{source.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {isUsed ? `This source is still used by ${usage?.agentCount} agent(s). Update those agents first.` : "Agents using this source will lose access to its tools."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
