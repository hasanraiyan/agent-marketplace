"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  CopyIcon,
  FingerprintIcon,
  GlobeIcon,
  InfoIcon,
  PlayIcon,
  RobotIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { AgentCodeDialog } from "@/components/agents/agent-code-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  createProjectAgent,
  updateProjectAgent,
  getProjectAgents,
  getProjectProviders,
  getProjectProviderModels,
  getProjectSkills,
  getProjectKnowledge,
  getProjectMcps,
  getProjectRestTools,
  getProjectRcpSources,
  getProjectStores,
} from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";
import { AttachItem } from "@/components/agents/attach-picker";
import { ProjectResourcePicker } from "@/components/agents/project-resource-picker";

const CATEGORIES = [
  { value: "productivity", label: "Productivity" },
  { value: "coding", label: "Coding" },
  { value: "creative", label: "Creative" },
  { value: "research", label: "Research" },
  { value: "roleplay", label: "Roleplay" },
  { value: "other", label: "Other" },
] as const;

const VISIBILITY = [
  {
    value: "private",
    label: "Private",
    description: "Only members of this Project can run it.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link can run it.",
  },
  {
    value: "public",
    label: "Public",
    description: "Listed on the public marketplace / Explore.",
  },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Visibility = (typeof VISIBILITY)[number]["value"];

interface Provider {
  _id?: string;
  id: string;
  label?: string;
  defaultModel?: string;
  isDefault?: boolean;
}

type AttachField =
  | "skills"
  | "mcps"
  | "knowledgeBases"
  | "restApiTools"
  | "rcpSources"
  | "storeMounts";

interface AgentFormState {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelName: string;
  webSearchEnabled: boolean;
  sandboxEnabled: boolean;
  visibility: Visibility;
  category: Category;
  isActive: boolean;
  skills: string[];
  mcps: string[];
  knowledgeBases: string[];
  restApiTools: string[];
  rcpSources: string[];
  storeMounts: string[];
}

const EMPTY_FORM: AgentFormState = {
  name: "",
  description: "",
  systemPrompt: "",
  providerId: "",
  modelName: "",
  webSearchEnabled: false,
  sandboxEnabled: false,
  visibility: "private",
  category: "other",
  isActive: true,
  skills: [],
  mcps: [],
  knowledgeBases: [],
  restApiTools: [],
  rcpSources: [],
  storeMounts: [],
};

interface FieldErrors {
  name?: string;
  systemPrompt?: string;
  providerId?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}

function rowsOf(res: { data?: { data?: unknown } }): Record<string, unknown>[] {
  const raw = (res.data as { data?: unknown } | undefined)?.data;
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { items?: unknown } | undefined)?.items ?? raw ?? []);
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

function toItem(
  row: Record<string, unknown>,
  meta: string | undefined,
): AttachItem {
  return {
    _id: (row._id as string) ?? undefined,
    id: (row.id as string) ?? undefined,
    name: String(row.name ?? ""),
    meta: meta || undefined,
    raw: row,
  };
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v);
}

function num(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : 0;
}

export function AgentForm({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId?: string;
}) {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const pid = params.projectId ?? projectId;
  const isEdit = !!agentId;

  const [form, setForm] = React.useState<AgentFormState>(EMPTY_FORM);
  const [agentMeta, setAgentMeta] = React.useState<{
    createdAt?: string;
    updatedAt?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = React.useState(false);

  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = React.useState(true);
  const [models, setModels] = React.useState<{ id: string }[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);

  const [skills, setSkills] = React.useState<AttachItem[]>([]);
  const [knowledge, setKnowledge] = React.useState<AttachItem[]>([]);
  const [mcps, setMcps] = React.useState<AttachItem[]>([]);
  const [restTools, setRestTools] = React.useState<AttachItem[]>([]);
  const [rcpSources, setRcpSources] = React.useState<AttachItem[]>([]);
  const [stores, setStores] = React.useState<AttachItem[]>([]);
  const [loadingAttaches, setLoadingAttaches] = React.useState(true);

  const [loading, setLoading] = React.useState(!!agentId);
  const [notFound, setNotFound] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [codeDialogOpen, setCodeDialogOpen] = React.useState(false);

  // Selected provider
  const selectedProvider = React.useMemo(
    () => providers.find((p) => (p.id ?? p._id) === form.providerId),
    [providers, form.providerId],
  );

  // Total attached resources count
  const totalAttachedCount = React.useMemo(() => {
    return (
      form.skills.length +
      form.knowledgeBases.length +
      form.mcps.length +
      form.restApiTools.length +
      form.rcpSources.length +
      form.storeMounts.length
    );
  }, [
    form.skills,
    form.knowledgeBases,
    form.mcps,
    form.restApiTools,
    form.rcpSources,
    form.storeMounts,
  ]);

  // Load Project providers once
  React.useEffect(() => {
    let cancelled = false;
    setLoadingProviders(true);
    getProjectProviders(pid)
      .then((res) => {
        if (cancelled) return;
        setProviders(rowsOf(res as never) as unknown as Provider[]);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  // Edit mode: hydrate form from list
  React.useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    setLoading(true);
    getProjectAgents(pid)
      .then((res) => {
        if (cancelled) return;
        const list = rowsOf(res as never);
        const found = list.find((a) => (a._id ?? a.id) === agentId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setAgentMeta({
          createdAt: str(found, "createdAt"),
          updatedAt: str(found, "updatedAt"),
        });
        const providerIdRaw = found.providerId;
        const providerId =
          typeof providerIdRaw === "string"
            ? providerIdRaw
            : providerIdRaw && typeof providerIdRaw === "object"
              ? String(
                  (providerIdRaw as { _id?: string; id?: string })._id ??
                    (providerIdRaw as { id?: string }).id ??
                    "",
                )
              : "";
        setForm({
          name: str(found, "name"),
          description: str(found, "description"),
          systemPrompt: str(found, "systemPrompt"),
          providerId,
          modelName: str(found, "modelName"),
          webSearchEnabled: !!found.webSearchEnabled,
          sandboxEnabled: !!found.sandboxEnabled,
          visibility: (found.visibility as Visibility) || "private",
          category: (found.category as Category) || "other",
          isActive: found.isActive !== false,
          skills:
            (found.skills as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
          mcps:
            (found.mcps as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
          knowledgeBases:
            (found.knowledgeBases as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
          restApiTools:
            (found.restApiTools as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
          rcpSources:
            (found.rcpSources as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
          storeMounts:
            (found.storeMounts as unknown[] | undefined)?.map((x) => {
              if (typeof x === "string") return x;
              const o = x as { _id?: string; id?: string };
              return String(o._id ?? o.id ?? "");
            }) ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid, agentId]);

  // Load attachable Project resource lists in parallel
  React.useEffect(() => {
    let cancelled = false;
    setLoadingAttaches(true);
    Promise.allSettled([
      getProjectSkills(pid).then((res) => {
        const rows = rowsOf(res as never);
        setSkills(
          rows.map((r) => toItem(r, str(r, "description") || undefined)),
        );
      }),
      getProjectKnowledge(pid).then((res) => {
        const rows = rowsOf(res as never);
        setKnowledge(
          rows.map((r) => {
            const docCount = num(r, "documentCount");
            const desc = str(r, "description");
            return toItem(
              r,
              desc || (docCount > 0 ? `${docCount} docs` : undefined),
            );
          }),
        );
      }),
      getProjectMcps(pid).then((res) => {
        const rows = rowsOf(res as never);
        setMcps(rows.map((r) => toItem(r, str(r, "url") || undefined)));
      }),
      getProjectRestTools(pid).then((res) => {
        const rows = rowsOf(res as never);
        setRestTools(
          rows.map((r) => {
            const desc = str(r, "description");
            const method = str(r, "method").toUpperCase();
            const url = str(r, "url");
            return toItem(
              r,
              desc || (method && url ? `${method} ${url}` : undefined),
            );
          }),
        );
      }),
      getProjectRcpSources(pid).then((res) => {
        const rows = rowsOf(res as never);
        setRcpSources(rows.map((r) => toItem(r, str(r, "url") || undefined)));
      }),
      getProjectStores(pid).then((res) => {
        const rows = rowsOf(res as never);
        setStores(
          rows.map((r) => {
            const scope = str(r, "scope");
            const accessMode = str(r, "accessMode");
            return toItem(
              r,
              scope
                ? accessMode
                  ? `${scope} · ${accessMode}`
                  : scope
                : undefined,
            );
          }),
        );
      }),
    ]).finally(() => {
      if (!cancelled) setLoadingAttaches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  // Preload provider's model choices
  React.useEffect(() => {
    if (!form.providerId) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    getProjectProviderModels(pid, form.providerId)
      .then((res) => {
        if (cancelled) return;
        const fetched = res.data?.data ?? [];
        setModels(
          Array.isArray(fetched)
            ? fetched.map((m: { id?: string }) => ({ id: m?.id ?? "" }))
            : [],
        );
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid, form.providerId]);

  const update = <K extends keyof AgentFormState>(
    key: K,
    value: AgentFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggle = (field: AttachField) => (id: string) =>
    setForm((prev) => {
      const arr = prev[field] as string[];
      const next = arr.includes(id)
        ? arr.filter((x) => x !== id)
        : [...arr, id];
      return { ...prev, [field]: next };
    });

  const noProviders = !loadingProviders && providers.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    const name = form.name.trim();
    const systemPrompt = form.systemPrompt.trim();
    if (name.length < 2 || name.length > 100)
      nextErrors.name = "Name must be 2–100 characters.";
    if (systemPrompt.length < 10)
      nextErrors.systemPrompt = "System prompt must be at least 10 characters.";
    if (!form.providerId) nextErrors.providerId = "Select an AI provider.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    const payload: Record<string, unknown> = {
      name,
      systemPrompt,
      providerId: form.providerId,
      webSearchEnabled: form.webSearchEnabled,
      sandboxEnabled: form.sandboxEnabled,
      visibility: form.visibility,
      category: form.category,
      isActive: form.isActive,
      skills: form.skills,
      mcps: form.mcps,
      knowledgeBases: form.knowledgeBases,
      restApiTools: form.restApiTools,
      rcpSources: form.rcpSources,
      storeMounts: form.storeMounts,
    };
    const description = form.description.trim();
    if (description) payload.description = description;
    const modelName = form.modelName.trim();
    if (modelName) payload.modelName = modelName;

    try {
      if (isEdit && agentId) {
        await updateProjectAgent(pid, agentId, payload);
      } else {
        await createProjectAgent(pid, payload);
      }
      deleteCachedByPrefix(cacheKey.resource(pid, "agents"));
      router.push(`/projects/${pid}/agents`);
    } catch (err) {
      setSaveError(
        errorMessage(
          err,
          isEdit ? "Failed to save agent." : "Failed to create agent.",
        ),
      );
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid w-full items-start gap-6 lg:grid-cols-12">
          <Skeleton className="h-[500px] w-full lg:col-span-8" />
          <Skeleton className="h-[320px] w-full lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link href={`/projects/${pid}/agents`} />}
              >
                Agents
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit agent</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <FieldError>Agent not found in this Project.</FieldError>
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link href={`/projects/${pid}/agents`} />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resourceBase = `/projects/${pid}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`${resourceBase}/agents`} />}>
                Agents
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[240px] truncate">
                {isEdit ? form.name || "Edit agent" : "New agent"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="flex size-8 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <RobotIcon className="size-4" />
              </span>
              <span className="truncate">
                {isEdit ? form.name || "Edit agent" : "New agent"}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              An Agent pairs an LLM provider with behavioral instructions and
              connected Project resources.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isEdit && agentId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCodeDialogOpen(true)}
                  className="gap-1.5"
                >
                  <CodeIcon className="size-3.5 text-primary" />
                  View Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`${resourceBase}/playground?agentId=${agentId}`}
                    />
                  }
                  className="gap-1.5 hover:border-primary/40 hover:bg-primary/5"
                >
                  <PlayIcon className="size-3.5 text-primary" weight="fill" />
                  Test in Playground
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={
                saving || (isEdit ? false : noProviders) || !form.providerId
              }
            >
              <CheckIcon data-icon="inline-start" />
              {saving ? "Saving…" : isEdit ? "Save agent" : "Create agent"}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Main Responsive Grid: 8 columns Workspace, 4 columns Control Sidebar */}
      <form
        onSubmit={handleSubmit}
        className="grid w-full items-start gap-6 lg:grid-cols-12"
      >
        {/* Main Workspace (col-span-8) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* 1. Identity & Model Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <SparkleIcon className="size-4 text-muted-foreground" />
                Identity & Model
              </CardTitle>
              <CardDescription>
                Define the agent&apos;s identity and select the foundation AI
                model provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="name">Agent Name</FieldLabel>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      required
                      maxLength={100}
                      placeholder="e.g. Research Assistant"
                    />
                    <FieldDescription>
                      A clear, identifiable name for your agent.
                    </FieldDescription>
                    {errors.name && <FieldError>{errors.name}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <Select
                      value={form.category}
                      onValueChange={(value) =>
                        update("category", (value ?? "other") as Category)
                      }
                    >
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Category for discovery and grouping.
                    </FieldDescription>
                  </Field>
                </div>

                {noProviders ? (
                  <Alert className="text-xs">
                    <WarningCircleIcon className="size-4" />
                    <AlertTitle className="text-xs">
                      No AI provider configured
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      Add an LLM provider before configuring this Agent.{" "}
                      <Link
                        className="font-medium text-primary underline underline-offset-4"
                        href={`${resourceBase}/providers/new`}
                      >
                        Create a provider
                      </Link>
                      .
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="providerId">AI Provider</FieldLabel>
                      {loadingProviders ? (
                        <Skeleton className="h-8 w-full" />
                      ) : (
                        <Select
                          value={form.providerId}
                          onValueChange={(value) => {
                            update("providerId", value ?? "");
                            update("modelName", "");
                          }}
                          itemToStringLabel={(value) => {
                            const provider = providers.find(
                              (p) => (p.id ?? p._id) === value,
                            );
                            return provider
                              ? provider.label || provider.id
                              : String(value ?? "");
                          }}
                        >
                          <SelectTrigger id="providerId" className="w-full">
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((p) => (
                              <SelectItem
                                key={p.id ?? p._id!}
                                value={p.id ?? p._id!}
                              >
                                {p.label || p.id}
                                {p.isDefault ? " (default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {errors.providerId && (
                        <FieldError>{errors.providerId}</FieldError>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="modelName">Model</FieldLabel>
                      <Input
                        id="modelName"
                        list="agent-model-options"
                        value={form.modelName}
                        onChange={(e) => update("modelName", e.target.value)}
                        maxLength={120}
                        disabled={!form.providerId}
                        placeholder={
                          loadingModels
                            ? "Loading models…"
                            : selectedProvider?.defaultModel
                              ? `e.g. ${selectedProvider.defaultModel}`
                              : "Leave blank for provider default"
                        }
                        className="font-mono text-sm"
                      />
                      <datalist id="agent-model-options">
                        {models.map((m) => (
                          <option key={m.id} value={m.id} />
                        ))}
                      </datalist>
                      <FieldDescription>
                        Model ID — blank uses provider default.
                      </FieldDescription>
                    </Field>
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Briefly describe what this Agent specializes in…"
                  />
                  <FieldDescription>
                    Short summary shown in cards and lists (under 500
                    characters).
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* 2. Persona & Core Instructions (System Prompt) */}
          <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <RobotIcon className="size-4 text-muted-foreground" />
                  System Prompt
                </CardTitle>
                <CardDescription>
                  The foundational instructions and behavioral boundaries
                  governing how the agent acts.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {form.systemPrompt.length} chars
              </Badge>
            </CardHeader>
            <CardContent>
              <Field>
                <Textarea
                  id="systemPrompt"
                  value={form.systemPrompt}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                  required
                  rows={10}
                  className="font-mono text-sm leading-relaxed"
                  placeholder="You are an expert AI assistant that helps users with..."
                />
                <FieldDescription>
                  At least 10 characters. Include role, style, rules, constraints
                  and response formats.
                </FieldDescription>
                {errors.systemPrompt && (
                  <FieldError>{errors.systemPrompt}</FieldError>
                )}
              </Field>
            </CardContent>
          </Card>

          {/* 3. Connected Tools & Resources */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <ProjectResourcePicker
                projectId={pid}
                skills={skills}
                knowledge={knowledge}
                mcps={mcps}
                restTools={restTools}
                rcpSources={rcpSources}
                stores={stores}
                loading={loadingAttaches}
                selected={{
                  skills: form.skills,
                  knowledgeBases: form.knowledgeBases,
                  mcps: form.mcps,
                  restApiTools: form.restApiTools,
                  rcpSources: form.rcpSources,
                  storeMounts: form.storeMounts,
                }}
                onToggle={(field, id) => toggle(field)(id)}
                onClearAll={() =>
                  setForm((prev) => ({
                    ...prev,
                    skills: [],
                    knowledgeBases: [],
                    mcps: [],
                    restApiTools: [],
                    rcpSources: [],
                    storeMounts: [],
                  }))
                }
              />
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                Note: Secrets and REST Tool Sources configure individual tools
                and connectors rather than attaching directly to Agents.
              </p>
            </CardContent>
          </Card>

          {saveError && <FieldError>{saveError}</FieldError>}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              render={<Link href={`${resourceBase}/agents`} />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to Agents
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`${resourceBase}/agents`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  saving || (isEdit ? false : noProviders) || !form.providerId
                }
              >
                <CheckIcon data-icon="inline-start" />
                {saving ? "Saving…" : isEdit ? "Save agent" : "Create agent"}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar / Auxiliary Section (col-span-4) */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Status & Access Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                Status & Access
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="isActive" className="text-xs font-medium">
                    Active Status
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Available for executions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={form.isActive ? "default" : "outline"}>
                    {form.isActive ? "Active" : "Disabled"}
                  </Badge>
                  <Switch
                    id="isActive"
                    checked={form.isActive}
                    onCheckedChange={(c) => update("isActive", !!c)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-b border-border/60 pb-3">
                <Label htmlFor="visibility" className="text-xs font-medium">
                  Visibility
                </Label>
                <Select
                  value={form.visibility}
                  onValueChange={(value) =>
                    update("visibility", (value ?? "private") as Visibility)
                  }
                >
                  <SelectTrigger id="visibility" className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {
                    VISIBILITY.find((v) => v.value === form.visibility)
                      ?.description
                  }
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attached Tools</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {totalAttachedCount} Total
                </Badge>
              </div>

              {isEdit && agentId && (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center gap-1.5 text-xs"
                    render={
                      <Link
                        href={`${resourceBase}/playground?agentId=${agentId}`}
                      />
                    }
                  >
                    <PlayIcon className="size-3 text-primary" weight="fill" />
                    Playground
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center gap-1.5 text-xs"
                    onClick={() => setCodeDialogOpen(true)}
                  >
                    <CodeIcon className="size-3.5 text-primary" />
                    View Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Runtime Capabilities Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <WrenchIcon className="size-4 text-muted-foreground" />
                Runtime Capabilities
              </CardTitle>
              <CardDescription>
                Enable built-in execution abilities for this agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex items-start justify-between gap-3 rounded-none border border-dashed border-border/80 bg-muted/10 p-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <GlobeIcon className="size-3.5 text-blue-500" />
                    Web Search
                  </div>
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    Allows real-time web querying via Tavily search.
                  </span>
                </div>
                <Switch
                  id="webSearchEnabled"
                  checked={form.webSearchEnabled}
                  onCheckedChange={(c) => update("webSearchEnabled", !!c)}
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-none border border-dashed border-border/80 bg-muted/10 p-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <TerminalWindowIcon className="size-3.5 text-amber-500" />
                    Code Sandbox
                  </div>
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    Runs shell commands safely inside an isolated CodeSandbox VM
                    (requires Project CSB Secret).
                  </span>
                </div>
                <Switch
                  id="sandboxEnabled"
                  checked={form.sandboxEnabled}
                  onCheckedChange={(c) => update("sandboxEnabled", !!c)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Details / Metadata (in Edit mode) */}
          {isEdit && agentId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <FingerprintIcon className="size-4 text-muted-foreground" />
                  Agent Details
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border/60 text-xs">
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-muted-foreground">Agent ID</span>
                  <div className="flex items-center gap-1">
                    <span className="max-w-[130px] truncate font-mono text-[11px] sm:max-w-[160px]">
                      {agentId}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Copy ID"
                      onClick={async () => {
                        await navigator.clipboard.writeText(agentId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 1500);
                      }}
                    >
                      <CopyIcon
                        data-icon="inline-start"
                        className={copiedId ? "text-primary" : undefined}
                      />
                    </Button>
                  </div>
                </div>

                {agentMeta?.createdAt && (
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ClockIcon className="size-3.5" />
                      Created
                    </span>
                    <span className="font-mono text-[11px]">
                      {new Date(agentMeta.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {selectedProvider && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium text-foreground">
                      {selectedProvider.label || selectedProvider.id}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Guidance Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <InfoIcon className="size-4 text-muted-foreground" />
                Agent Execution Model
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <p>
                At runtime, your agent executes with its instructions, model,
                and every attached resource: skills (guidelines), knowledge bases
                (RAG retrieval), MCP + REST + RCP sources (tool calling), and
                mounted storage filesystems.
              </p>
              <Separator />
              <p className="text-[11px]">
                Tip: Start with a clear system prompt and 1–2 focused tools, then
                verify reasoning steps interactively in the Playground.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>

      {isEdit && agentId && (
        <AgentCodeDialog
          open={codeDialogOpen}
          onOpenChange={setCodeDialogOpen}
          agentId={agentId}
          agentName={form.name}
          projectId={pid}
        />
      )}
    </div>
  );
}
