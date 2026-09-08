"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  InfoIcon,
  RobotIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AttachItem, AttachPicker } from "@/components/agents/attach-picker";

const CATEGORIES = [
  { value: "productivity", label: "Productivity" },
  { value: "coding", label: "Coding" },
  { value: "creative", label: "Creative" },
  { value: "research", label: "Research" },
  { value: "roleplay", label: "Roleplay" },
  { value: "other", label: "Other" },
] as const;

const VISIBILITY = [
  { value: "private", label: "Private", description: "Only members of this Project can run it." },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can run it." },
  { value: "public", label: "Public", description: "Listed on the marketplace / Explore." },
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

interface AgentDoc {
  _id: string;
  id?: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  providerId?: string | { _id?: string; id?: string };
  modelName?: string;
  webSearchEnabled?: boolean;
  visibility?: Visibility;
  category?: Category;
  isActive?: boolean;
  skills?: unknown[];
  mcps?: unknown[];
  knowledgeBases?: unknown[];
  restApiTools?: unknown[];
  rcpSources?: unknown[];
  storeMounts?: unknown[];
}

type AttachField = "skills" | "mcps" | "knowledgeBases" | "restApiTools" | "rcpSources" | "storeMounts";

interface AgentFormState {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelName: string;
  webSearchEnabled: boolean;
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
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

// Normalizes every Project list endpoint's body to a plain array — same shape
// ResourceListPage relies on ({ data: data | { items } }).
function rowsOf(res: { data?: { data?: unknown } }): Record<string, unknown>[] {
  const raw = (res.data as { data?: unknown } | undefined)?.data;
  const list = Array.isArray(raw) ? raw : ((raw as { items?: unknown } | undefined)?.items ?? raw ?? []);
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

function toItem(row: Record<string, unknown>, meta: string | undefined): AttachItem {
  return {
    _id: (row._id as string) ?? undefined,
    id: (row.id as string) ?? undefined,
    name: String(row.name ?? ""),
    meta: meta || undefined,
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

export function AgentForm({ projectId, agentId }: { projectId: string; agentId?: string }) {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const pid = params.projectId ?? projectId;
  const isEdit = !!agentId;

  const [form, setForm] = React.useState<AgentFormState>(EMPTY_FORM);
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

  // The selected provider (for the default-model hint under the model input).
  const selectedProvider = React.useMemo(
    () => providers.find((p) => (p.id ?? p._id) === form.providerId),
    [providers, form.providerId]
  );

  // Load Project providers once (create + edit both need the picker).
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

  // Edit mode: there is no single-item GET — find the Agent in the Project's
  // list (the Platform convention) and hydrate the form from it.
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
        const providerIdRaw = found.providerId;
        const providerId =
          typeof providerIdRaw === "string"
            ? providerIdRaw
            : providerIdRaw && typeof providerIdRaw === "object"
              ? String((providerIdRaw as { _id?: string; id?: string })._id ?? (providerIdRaw as { id?: string }).id ?? "")
              : "";
        setForm({
          name: str(found, "name"),
          description: str(found, "description"),
          systemPrompt: str(found, "systemPrompt"),
          providerId,
          modelName: str(found, "modelName"),
          webSearchEnabled: !!found.webSearchEnabled,
          visibility: (found.visibility as Visibility) || "private",
          category: (found.category as Category) || "other",
          isActive: found.isActive !== false,
          skills: (found.skills as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
          mcps: (found.mcps as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
          knowledgeBases: (found.knowledgeBases as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
          restApiTools: (found.restApiTools as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
          rcpSources: (found.rcpSources as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
          storeMounts: (found.storeMounts as unknown[] | undefined)?.map((x) => {
            if (typeof x === "string") return x;
            const o = x as { _id?: string; id?: string };
            return String(o._id ?? o.id ?? "");
          }) ?? [],
        });
      })
      .catch((err) => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid, agentId]);

  // Load all six attachable Project resource lists in parallel. Each list is
  // independent — one failing list just renders as its empty state.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingAttaches(true);
    Promise.allSettled([
      getProjectSkills(pid).then((res) => {
        const rows = rowsOf(res as never);
        setSkills(rows.map((r) => toItem(r, str(r, "description") || undefined)));
      }),
      getProjectKnowledge(pid).then((res) => {
        const rows = rowsOf(res as never);
        setKnowledge(
          rows.map((r) => {
            const docCount = num(r, "documentCount");
            const desc = str(r, "description");
            return toItem(r, desc || (docCount > 0 ? `${docCount} docs` : undefined));
          })
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
            return toItem(r, desc || (method && url ? `${method} ${url}` : undefined));
          })
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
            return toItem(r, scope ? (accessMode ? `${scope} · ${accessMode}` : scope) : undefined);
          })
        );
      }),
    ]).finally(() => {
      if (!cancelled) setLoadingAttaches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  // When the provider changes, preload that provider's model ids so the model
  // input can suggest valid choices (saved provider creds are used server-side).
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
        setModels(Array.isArray(fetched) ? fetched.map((m: { id?: string }) => ({ id: m?.id ?? "" })) : []);
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

  const update = <K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggle = (field: AttachField) => (id: string) =>
    setForm((prev) => {
      const arr = prev[field] as string[];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [field]: next };
    });

  const noProviders = !loadingProviders && providers.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    const name = form.name.trim();
    const systemPrompt = form.systemPrompt.trim();
    if (name.length < 2 || name.length > 100) nextErrors.name = "Name must be 2–100 characters.";
    if (systemPrompt.length < 10) nextErrors.systemPrompt = "System prompt must be at least 10 characters.";
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
      setSaveError(errorMessage(err, isEdit ? "Failed to save agent." : "Failed to create agent."));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-6 w-32" />
        <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[560px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${pid}/agents`} />}>Agents</BreadcrumbLink>
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
            <Button type="button" variant="outline" size="sm" render={<Link href={`/projects/${pid}/agents`} />}>
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
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`${resourceBase}/agents`} />}>Agents</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{isEdit ? `Edit ${form.name || agentId}` : "New agent"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <RobotIcon />
          </span>
          {isEdit ? "Edit agent" : "New agent"}
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">
          An Agent pairs a model provider with instructions and the Project resources it can use at run time.
        </p>
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <div className="flex flex-col gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Name, model, and the instructions that define how the Agent behaves.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g. Research Assistant"
                  />
                  <FieldDescription>2–100 characters. The backend derives a unique slug from this.</FieldDescription>
                  {errors.name && <FieldError>{errors.name}</FieldError>}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <Select
                      value={form.category}
                      onValueChange={(value) => update("category", (value ?? "other") as Category)}
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
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
                    <Select
                      value={form.visibility}
                      onValueChange={(value) => update("visibility", (value ?? "private") as Visibility)}
                    >
                      <SelectTrigger id="visibility" className="w-full">
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
                    <FieldDescription>
                      {VISIBILITY.find((v) => v.value === form.visibility)?.description}
                    </FieldDescription>
                  </Field>
                </div>

                {noProviders ? (
                  <Alert>
                    <WarningCircleIcon />
                    <AlertTitle>No AI provider configured</AlertTitle>
                    <AlertDescription>
                      Add an LLM provider before creating an Agent.{" "}
                      <Link className="underline underline-offset-4" href={`${resourceBase}/providers/new`}>
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
                            // A model only makes sense for the provider that owns it.
                            update("modelName", "");
                          }}
                        >
                          <SelectTrigger id="providerId" className="w-full">
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((p) => (
                              <SelectItem key={p.id ?? p._id!} value={p.id ?? p._id!}>
                                {p.label || p.id}
                                {p.isDefault ? " (default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {errors.providerId && <FieldError>{errors.providerId}</FieldError>}
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
                              : "Leave blank for the provider default"
                        }
                        className="font-mono text-sm"
                      />
                      <datalist id="agent-model-options">
                        {models.map((m) => (
                          <option key={m.id} value={m.id} />
                        ))}
                      </datalist>
                      <FieldDescription>
                        Model id for this provider — blank uses the provider&apos;s default model.
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
                    placeholder="What this Agent specializes in…"
                  />
                  <FieldDescription>Under 500 characters.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="systemPrompt">System prompt</FieldLabel>
                  <Textarea
                    id="systemPrompt"
                    value={form.systemPrompt}
                    onChange={(e) => update("systemPrompt", e.target.value)}
                    required
                    rows={10}
                    className="font-mono text-sm"
                    placeholder="What does this agent do? How does it behave? What should it avoid?"
                  />
                  <FieldDescription>At least 10 characters. This is the agent&apos;s core instruction.</FieldDescription>
                  {errors.systemPrompt && <FieldError>{errors.systemPrompt}</FieldError>}
                </Field>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-none border border-dashed bg-muted/10 px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="webSearchEnabled" className="text-sm font-medium">
                        Web search
                      </Label>
                      <span className="text-xs text-muted-foreground">Allow the agent to search the web</span>
                    </div>
                    <Switch
                      id="webSearchEnabled"
                      checked={form.webSearchEnabled}
                      onCheckedChange={(c) => update("webSearchEnabled", !!c)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-none border border-dashed bg-muted/10 px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="isActive" className="text-sm font-medium">
                        Active
                      </Label>
                      <span className="text-xs text-muted-foreground">Can this agent be run in the Playground?</span>
                    </div>
                    <Switch
                      id="isActive"
                      checked={form.isActive}
                      onCheckedChange={(c) => update("isActive", !!c)}
                    />
                  </div>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>
                The Project resources this Agent can use at run time. Picks persist as the attach arrays on the Agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <AttachPicker
                  field="skills"
                  title="Skills"
                  hint="skills — reusable instructions"
                  items={skills}
                  loading={loadingAttaches}
                  selected={form.skills}
                  onToggle={toggle("skills")}
                  createHref={`${resourceBase}/skills/new`}
                  emptyNoun="a skill"
                />
                <AttachPicker
                  field="knowledgeBases"
                  title="Knowledge"
                  hint="knowledgeBases — documents to search"
                  items={knowledge}
                  loading={loadingAttaches}
                  selected={form.knowledgeBases}
                  onToggle={toggle("knowledgeBases")}
                  createHref={`${resourceBase}/knowledge/new`}
                  emptyNoun="a knowledge base"
                />
                <AttachPicker
                  field="mcps"
                  title="MCP"
                  hint="mcps — MCP tool servers"
                  items={mcps}
                  loading={loadingAttaches}
                  selected={form.mcps}
                  onToggle={toggle("mcps")}
                  createHref={`${resourceBase}/mcps/new`}
                  emptyNoun="an MCP server"
                />
                <AttachPicker
                  field="restApiTools"
                  title="REST Tools"
                  hint="restApiTools — no-code HTTP tools"
                  items={restTools}
                  loading={loadingAttaches}
                  selected={form.restApiTools}
                  onToggle={toggle("restApiTools")}
                  createHref={`${resourceBase}/rest-tools/new`}
                  emptyNoun="a REST tool"
                />
                <AttachPicker
                  field="rcpSources"
                  title="RCP Sources"
                  hint="rcpSources — REST Connector Protocol sources"
                  items={rcpSources}
                  loading={loadingAttaches}
                  selected={form.rcpSources}
                  onToggle={toggle("rcpSources")}
                  createHref={`${resourceBase}/rcp-sources/new`}
                  emptyNoun="an RCP source"
                />
                <AttachPicker
                  field="storeMounts"
                  title="Stores"
                  hint="storeMounts — scoped mount points"
                  items={stores}
                  loading={loadingAttaches}
                  selected={form.storeMounts}
                  onToggle={toggle("storeMounts")}
                  createHref={`${resourceBase}/stores/new`}
                  emptyNoun="a store"
                />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                Secrets and REST Tool Sources aren&apos;t attachable to Agents — they configure individual tools/MCP
                servers, and Platform has no Agent-level secrets field.
              </p>
            </CardContent>
          </Card>

          {saveError && <FieldError>{saveError}</FieldError>}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="ghost" size="sm" render={<Link href={`${resourceBase}/agents`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`${resourceBase}/agents`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || (isEdit ? false : noProviders) || !form.providerId}>
                {saving ? "Saving…" : isEdit ? "Save agent" : "Create agent"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                What an Agent loads
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                At run time the agent loads its system prompt, the provider&apos;s model, and every attached resource:
                skills (instructions), knowledge bases (retrieval), MCP + REST + RCP sources (tools), and stores
                (mounted filesystems).
              </p>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              Start with a provider and one skill or knowledge base — then test the agent in the{" "}
              <Link className="underline underline-offset-4" href={`${resourceBase}/playground`}>
                Playground
              </Link>
              .
            </AlertDescription>
          </Alert>
        </div>
      </form>
    </div>
  );
}
