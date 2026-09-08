"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CpuIcon,
  FingerprintIcon,
  ClockIcon,
  CopyIcon,
  InfoIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningCircleIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getProjectProviders,
  updateProjectProvider,
  deleteProjectProvider,
  getProjectProviderModels,
  getProjectProviderUsage,
  testProjectProviderConnection,
  testProviderCredentials,
} from "@/lib/api/projects";

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "Custom" },
];

interface Provider {
  _id?: string;
  id: string;
  label: string;
  type: string;
  baseURL: string;
  defaultModel: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function EditProviderPage() {
  const { projectId, providerId } = useParams<{ projectId: string; providerId: string }>();
  const router = useRouter();
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    type: "",
    label: "",
    baseURL: "",
    apiKey: "",
    defaultModel: "",
    isDefault: false,
  });
  const [models, setModels] = React.useState<{ id: string }[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);
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
    let cancelled = false;
    setLoading(true);
    getProjectProviders(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Provider[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((p) => (p.id ?? p._id) === providerId || p._id === providerId);
        if (!found) {
          setLoadError("Provider not found.");
        } else {
          setProvider(found);
          setFormData({
            type: found.type || "custom",
            label: found.label || "",
            baseURL: found.baseURL || "",
            apiKey: "",
            defaultModel: found.defaultModel || "",
            isDefault: !!found.isDefault,
          });
          // preload models using saved creds
          getProjectProviderModels(projectId, found.id ?? (found._id as string))
            .then((r) => {
              if (!cancelled) {
                const fetched = r.data?.data || [];
                setModels(Array.isArray(fetched) ? fetched : []);
              }
            })
            .catch(() => {});
          // preload usage
          getProjectProviderUsage(projectId, found.id ?? (found._id as string))
            .then((r) => {
              if (!cancelled) setUsage(r.data?.data ?? null);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load provider."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, providerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement & { checked: boolean };
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    setSaveError(null);
    try {
      const targetId = provider?.id ?? provider?._id;
      let res;
      if (targetId && !formData.apiKey) {
        res = await getProjectProviderModels(projectId, targetId);
      } else {
        if (!formData.type) {
          setSaveError("Please select a provider type first.");
          return;
        }
        const needsBaseUrl = formData.type === "custom";
        if (!formData.apiKey || (needsBaseUrl && !formData.baseURL)) {
          setSaveError(needsBaseUrl ? "Please provide both Base URL and API Key to fetch models." : "Please provide an API Key to fetch models.");
          return;
        }
        res = await testProviderCredentials(formData.type, needsBaseUrl ? formData.baseURL : undefined, formData.apiKey);
      }
      const fetched = res.data?.data?.models || res.data?.data || [];
      setModels(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to fetch models. Check your credentials."));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTest = async () => {
    if (!provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const targetId = provider.id ?? provider._id ?? providerId;
      const res = await testProjectProviderConnection(projectId, targetId);
      const msg = res.data?.data?.message || res.data?.message || "Connection successful.";
      setTestResult(msg);
    } catch (err) {
      setTestResult(errorMessage(err, "Connection failed."));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data: Record<string, unknown> = { ...formData };
      if (data.type !== "custom") delete data.baseURL;
      if (!data.apiKey) delete data.apiKey;
      const targetId = provider.id ?? provider._id ?? providerId;
      await updateProjectProvider(projectId, targetId, data);
      router.push(`/projects/${projectId}/providers`);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save provider."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!provider) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = provider.id ?? provider._id ?? providerId;
      await deleteProjectProvider(projectId, targetId);
      router.push(`/projects/${projectId}/providers`);
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete provider. It may still be used by agents."));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[560px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !provider) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/providers`} />}>Providers</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Provider not found</CardTitle>
            <CardDescription>{loadError ?? "This provider does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/providers`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to providers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.agentCount ?? 0) > 0;
  const providerIdDisplay = provider.id ?? provider._id ?? providerId;

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/providers`} />}>Providers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{provider.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <CpuIcon />
          </span>
          Edit provider
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Update credentials, base URL, default model or default flag. Leave API key blank to keep the current one.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>Native types fill the canonical Base URL automatically — only Custom needs it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="type">Provider</FieldLabel>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, type: value, baseURL: "", defaultModel: "" }));
                      setModels([]);
                    }}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="label">Label</FieldLabel>
                  <Input id="label" name="label" value={formData.label} onChange={handleChange} required maxLength={100} />
                  <FieldDescription>A friendly name for this provider.</FieldDescription>
                </Field>

                {formData.type === "custom" && (
                  <Field>
                    <FieldLabel htmlFor="baseURL">Base URL</FieldLabel>
                    <Input id="baseURL" name="baseURL" type="url" placeholder="https://api.openai.com/v1" value={formData.baseURL} onChange={handleChange} required />
                    <FieldDescription>The API endpoint for the provider.</FieldDescription>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
                  <Input id="apiKey" name="apiKey" type="password" placeholder="••••••••••••••••" value={formData.apiKey} onChange={handleChange} />
                  <FieldDescription>Leave blank to keep the existing key.</FieldDescription>
                </Field>

                <Field>
                  <div className="mb-2 flex items-center justify-between">
                    <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
                    <Button type="button" variant="outline" size="sm" onClick={fetchModels} disabled={loadingModels}>
                      {loadingModels ? "Fetching…" : "Fetch Models"}
                    </Button>
                  </div>
                  <Select
                    value={formData.defaultModel}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, defaultModel: value }))}
                    required
                  >
                    <SelectTrigger id="defaultModel">
                      <SelectValue placeholder="Select a default model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.length > 0 ? (
                        models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.id}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>
                          {formData.defaultModel || "No models fetched yet"}
                        </SelectItem>
                      )}
                      {models.length === 0 && formData.defaultModel && (
                        <SelectItem value={formData.defaultModel}>{formData.defaultModel}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FieldDescription>The model used by default for Agents attached to this provider.</FieldDescription>
                </Field>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isDefault: !!checked }))}
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="isDefault" className="text-sm font-medium leading-none">
                      Set as default provider
                    </label>
                    <p className="text-xs text-muted-foreground">Used by default for this Project&apos;s new Agents.</p>
                  </div>
                </div>
              </FieldGroup>

              {saveError && <FieldError>{saveError}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/providers`} />}>
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test connection"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/providers`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Update provider"}
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
                  <span className="max-w-[140px] truncate font-mono text-[11px] sm:max-w-[180px]">{providerIdDisplay}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(providerIdDisplay);
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
                <span className="font-mono text-[11px]">{provider.createdAt ? new Date(provider.createdAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CpuIcon className="size-3.5" />
                  Type
                </span>
                <Badge variant="outline" className="capitalize">
                  {provider.type || "custom"}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Base URL</span>
                <span className="max-w-[180px] truncate font-mono text-[11px]">{provider.baseURL || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Default Model</span>
                <span className="font-mono text-[11px]">{provider.defaultModel || "—"}</span>
              </div>
            </CardContent>
          </Card>

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
              <CardDescription>Deleting is blocked while agents still use this provider.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && <FieldError>{deleteError}</FieldError>}
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white" onClick={() => setDeleteOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete provider
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete provider “{provider.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {isUsed ? `This provider is still used by ${usage?.agentCount} agent(s). Update those agents first.` : "Agents using this provider will need a new provider."}
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
