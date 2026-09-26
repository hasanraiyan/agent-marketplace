"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CopyIcon,
  FingerprintIcon,
  InfoIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WarningCircleIcon,
  WrenchIcon,
  ArrowClockwiseIcon,
  SlidersIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ContextParamMapper } from "@/components/tools/context-param-mapper";

interface Secret {
  _id?: string;
  id: string;
  label: string;
}

interface RcpToolParam {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

interface RcpTool {
  name: string;
  description?: string;
  method?: string;
  url?: string;
  params?: RcpToolParam[];
}

interface ParamContextMapEntry {
  param: string;
  contextKey: string;
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
  paramContextMap?: ParamContextMapEntry[];
  lastTestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}

export default function EditRcpSourcePage() {
  const { projectId, sourceId } = useParams<{
    projectId: string;
    sourceId: string;
  }>();
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

  // param name -> contextKey the caller's per-turn `context` object should
  // supply it from; blank means "not mapped" (param stays exposed to the
  // model as a normal tool argument). TURN_CONTEXT_RCP_RESOLVERS_PLAN.md.
  const [contextKeys, setContextKeys] = React.useState<Record<string, string>>(
    {},
  );

  const [usage, setUsage] = React.useState<{
    agentCount: number;
    agents: { _id: string; name: string }[];
  } | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);
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
          const initialKeys: Record<string, string> = {};
          for (const entry of found.paramContextMap || []) {
            initialKeys[entry.param] = entry.contextKey;
          }
          setContextKeys(initialKeys);
          getProjectRcpSourceUsage(projectId, found.id ?? (found._id as string))
            .then((r) => {
              if (!cancelled) setUsage(r.data?.data ?? null);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(errorMessage(err, "Failed to load RCP source."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, sourceId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Every distinct param name across all discovered tools
  const allParams = React.useMemo(() => {
    const byName = new Map<string, RcpToolParam>();
    for (const tool of source?.tools || []) {
      for (const param of tool.params || []) {
        if (!byName.has(param.name)) byName.set(param.name, param);
      }
    }
    return Array.from(byName.values());
  }, [source?.tools]);

  const mappedParamsCount = React.useMemo(() => {
    return Object.values(contextKeys).filter((k) => (k || "").trim().length > 0)
      .length;
  }, [contextKeys]);

  const handleContextKeyChange = (param: string, value: string) => {
    setContextKeys((prev) => ({ ...prev, [param]: value }));
  };

  const handleTest = async () => {
    if (!source) return;
    setTesting(true);
    setTestResult(null);
    try {
      const targetId = source.id ?? source._id ?? sourceId;
      const res = await testProjectRcpSource(projectId, targetId);
      const tools: RcpTool[] | undefined = res.data?.data?.tools;
      const msg =
        res.data?.data?.message ||
        res.data?.message ||
        (tools ? `Discovered ${tools.length} tool(s).` : "Connection verified.");
      setTestResult({ success: true, message: msg });
      if (tools) {
        setSource((prev) =>
          prev
            ? { ...prev, tools, lastTestedAt: new Date().toISOString() }
            : prev,
        );
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: errorMessage(err, "Connection test failed."),
      });
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
      data.paramContextMap = allParams
        .map((p) => ({
          param: p.name,
          contextKey: (contextKeys[p.name] || "").trim(),
        }))
        .filter((entry) => entry.contextKey.length > 0);
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
      setDeleteError(
        errorMessage(
          err,
          "Failed to delete RCP source. It may still be used by agents.",
        ),
      );
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[400px] w-full lg:col-span-8" />
          <Skeleton className="h-[280px] w-full lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (loadError || !source) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link href={`/projects/${projectId}/rcp-sources`} />}
              >
                RCP
              </BreadcrumbLink>
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
            <CardDescription>
              {loadError ?? "This source does not exist."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/projects/${projectId}/rcp-sources`} />}
            >
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link href={`/projects/${projectId}/rcp-sources`} />}
              >
                RCP
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[240px] truncate">
                {source.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="flex size-8 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <WrenchIcon className="size-4" />
              </span>
              <span className="truncate">{source.name}</span>
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Manage manifest endpoint, discovered tools, and automated context
              parameter mappings.
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2 sm:mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              <ArrowClockwiseIcon
                data-icon="inline-start"
                className={testing ? "animate-spin" : ""}
              />
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={saving}
            >
              <CheckIcon data-icon="inline-start" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Main Responsive Grid Layout: 8 cols for Workspace, 4 cols for Info/Sidebar */}
      <div className="grid w-full items-start gap-6 lg:grid-cols-12">
        {/* Primary Workspace (col-span-8) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* 1. Source Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Source configuration
              </CardTitle>
              <CardDescription>
                Configure the manifest URL and authentication header required to
                discover endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <FieldGroup className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="name">Source name</FieldLabel>
                      <Input
                        id="name"
                        name="name"
                        placeholder="e.g. crm-service"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        minLength={2}
                        maxLength={100}
                      />
                      <FieldDescription>
                        A recognizable name for this connector.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="url">Manifest URL</FieldLabel>
                      <Input
                        id="url"
                        name="url"
                        type="url"
                        placeholder="https://api.example.com/.well-known/rcp.json"
                        value={formData.url}
                        onChange={handleChange}
                        required
                      />
                      <FieldDescription>
                        Endpoint serving the RCP tool manifest.
                      </FieldDescription>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="What services or actions does this RCP source provide?"
                      value={formData.description}
                      onChange={handleChange}
                      maxLength={500}
                      rows={2}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="authType">Authentication</FieldLabel>
                      <Select
                        value={formData.authType}
                        onValueChange={(value: string | null) =>
                          setFormData((prev) => ({
                            ...prev,
                            authType: value ?? "none",
                          }))
                        }
                      >
                        <SelectTrigger id="authType">
                          <SelectValue placeholder="Select auth type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Public)</SelectItem>
                          <SelectItem value="header">
                            Header (Project Secret)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Select authentication requirements.
                      </FieldDescription>
                    </Field>

                    {formData.authType === "header" && (
                      <Field>
                        <FieldLabel htmlFor="secretRef">
                          Attached secret
                        </FieldLabel>
                        {secrets && secrets.length === 0 ? (
                          <div className="rounded-none border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                            No secrets found.{" "}
                            <Link
                              href={`/projects/${projectId}/secrets/new`}
                              className="font-medium text-primary underline underline-offset-4"
                            >
                              Create a secret
                            </Link>{" "}
                            first.
                          </div>
                        ) : (
                          <Select
                            value={formData.secretRef}
                            onValueChange={(value: string | null) =>
                              setFormData((prev) => ({
                                ...prev,
                                secretRef: value ?? "",
                              }))
                            }
                          >
                            <SelectTrigger id="secretRef">
                              <SelectValue
                                placeholder={
                                  secrets === null
                                    ? "Loading secrets…"
                                    : "Select a secret"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(secrets ?? []).map((s) => (
                                <SelectItem
                                  key={s.id ?? s._id}
                                  value={(s.id ?? s._id) as string}
                                >
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <FieldDescription>
                          Injected as Authorization header per request.
                        </FieldDescription>
                      </Field>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox
                      id="isEnabled"
                      checked={formData.isEnabled}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          isEnabled: !!checked,
                        }))
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor="isEnabled"
                        className="cursor-pointer text-sm font-medium leading-none"
                      >
                        Enabled for Agent attachment
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Disabled sources remain configured but are omitted from
                        Agent execution.
                      </p>
                    </div>
                  </div>
                </FieldGroup>

                {saveError && <FieldError>{saveError}</FieldError>}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    render={
                      <Link href={`/projects/${projectId}/rcp-sources`} />
                    }
                  >
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back to list
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/projects/${projectId}/rcp-sources`)
                      }
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Saving…" : "Save configuration"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* 2. Discovered Tools Grid */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <WrenchIcon className="size-4 text-muted-foreground" />
                  Discovered Tools
                  <Badge variant="secondary" className="font-mono text-xs">
                    {source.tools?.length || 0}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Tools discovered from the manifest endpoints and available to
                  attached agents.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
                className="shrink-0"
              >
                <ArrowClockwiseIcon
                  data-icon="inline-start"
                  className={testing ? "animate-spin" : ""}
                />
                {testing ? "Refreshing…" : "Refresh tools"}
              </Button>
            </CardHeader>
            <CardContent>
              {source.tools && source.tools.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {source.tools.map((t) => (
                    <div
                      key={t.name}
                      className="flex flex-col justify-between gap-2.5 rounded-none border border-border/70 bg-card p-3 shadow-xs transition-colors hover:border-border"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] uppercase tracking-wider"
                            >
                              {t.method || "RCP"}
                            </Badge>
                            <span
                              className="truncate font-mono text-xs font-semibold text-foreground"
                              title={t.name}
                            >
                              {t.name}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 font-mono text-[10px]"
                          >
                            {(t.params || []).length} param
                            {(t.params || []).length === 1 ? "" : "s"}
                          </Badge>
                        </div>

                        {t.description && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </div>

                      {t.params && t.params.length > 0 ? (
                        <div className="flex flex-wrap gap-1 border-t border-border/50 pt-2">
                          {t.params.map((p) => {
                            const isMapped =
                              (contextKeys[p.name] || "").trim().length > 0;
                            return (
                              <span
                                key={p.name}
                                className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] ${
                                  isMapped
                                    ? "border-primary/40 bg-primary/10 font-medium text-primary"
                                    : "border-border bg-muted/40 text-muted-foreground"
                                }`}
                                title={
                                  isMapped
                                    ? `Mapped to context: ${contextKeys[p.name]}`
                                    : `Argument exposed to LLM`
                                }
                              >
                                {p.name}
                                <span className="text-[9px] opacity-70">
                                  :{p.type || "str"}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          No parameters
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-none border border-dashed border-border py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-none bg-muted text-muted-foreground">
                    <WrenchIcon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">No tools discovered</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Click &ldquo;Test connection&rdquo; to fetch the manifest
                      and discover available tools.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    <ArrowClockwiseIcon
                      data-icon="inline-start"
                      className={testing ? "animate-spin" : ""}
                    />
                    {testing ? "Testing connection…" : "Test connection now"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Full-Width Context Parameters Mapping */}
          {allParams.length > 0 && (
            <Card>
              <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <SlidersIcon className="size-4 text-muted-foreground" />
                    Context Parameters
                    <Badge variant="outline" className="font-mono text-xs">
                      {mappedParamsCount} / {allParams.length} mapped
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Map tool parameters to runtime context keys. Mapped
                    parameters are resolved live from verified system or turn
                    state, never exposed to the model.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ContextParamMapper
                  params={allParams}
                  contextKeys={contextKeys}
                  onChangeKey={handleContextKeyChange}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar / Auxiliary Section (col-span-4) */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Status & Connectivity Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CheckCircleIcon className="size-4 text-muted-foreground" />
                Connection & Health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={formData.isEnabled ? "default" : "outline"}>
                  {formData.isEnabled ? "Active" : "Disabled"}
                </Badge>
              </div>

              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Last Tested</span>
                <span className="font-mono text-[11px]">
                  {source.lastTestedAt
                    ? new Date(source.lastTestedAt).toLocaleString()
                    : "Never"}
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full justify-center"
                >
                  <ArrowClockwiseIcon
                    data-icon="inline-start"
                    className={testing ? "animate-spin" : ""}
                  />
                  {testing ? "Testing connection…" : "Test connection"}
                </Button>

                {testResult && (
                  <Alert
                    variant={testResult.success ? "default" : "destructive"}
                    className="p-2.5 text-xs"
                  >
                    {testResult.success ? (
                      <CheckCircleIcon className="size-3.5" />
                    ) : (
                      <WarningCircleIcon className="size-3.5" />
                    )}
                    <AlertDescription className="text-xs leading-tight">
                      {testResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FingerprintIcon className="size-4 text-muted-foreground" />
                Source Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border/60 text-xs">
              <div className="flex items-center justify-between gap-2 py-2">
                <span className="text-muted-foreground">Source ID</span>
                <div className="flex items-center gap-1">
                  <span className="max-w-[130px] truncate font-mono text-[11px] sm:max-w-[160px]">
                    {sourceIdDisplay}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(sourceIdDisplay);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <CopyIcon
                      data-icon="inline-start"
                      className={copied ? "text-primary" : undefined}
                    />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Created
                </span>
                <span className="font-mono text-[11px]">
                  {source.createdAt
                    ? new Date(source.createdAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>

              {source.updatedAt && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-mono text-[11px]">
                    {new Date(source.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Usage Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <PlugsConnectedIcon className="size-4 text-muted-foreground" />
                Agent Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {usage ? (
                isUsed ? (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-muted-foreground">
                      Attached to{" "}
                      <span className="font-semibold text-foreground">
                        {usage.agentCount}
                      </span>{" "}
                      agent(s):
                    </p>
                    <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pl-1">
                      {usage.agents.map((a) => (
                        <li
                          key={a._id}
                          className="flex items-center gap-2 rounded-none bg-muted/40 px-2 py-1"
                        >
                          <span className="size-1.5 rounded-full bg-primary" />
                          <span className="truncate font-mono text-[11px]">
                            {a.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Not currently attached to any agents.
                  </p>
                )
              ) : (
                <p className="text-muted-foreground">Loading usage…</p>
              )}
            </CardContent>
          </Card>

          {isUsed && usage && (
            <Alert className="text-xs">
              <InfoIcon className="size-4" />
              <AlertTitle className="text-xs font-semibold">
                In Active Use
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Detach this source from attached agents before attempting
                deletion.
              </AlertDescription>
            </Alert>
          )}

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
                <TrashIcon className="size-4" />
                Danger zone
              </CardTitle>
              <CardDescription>
                Deleting is blocked while agents still use this source.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && <FieldError>{deleteError}</FieldError>}
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-center bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                onClick={() => setDeleteOpen(true)}
              >
                <TrashIcon data-icon="inline-start" />
                Delete RCP source
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete RCP source &ldquo;{source.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.{" "}
              {isUsed
                ? `This source is still used by ${usage?.agentCount} agent(s). Detach or update those agents first.`
                : "Agents will immediately lose access to tools discovered from this source."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
