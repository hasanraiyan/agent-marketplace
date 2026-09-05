"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { AguiAgentChat } from "@/components/agents/agui-agent-chat";
import {
  getProjectAgents,
  createProjectAgent,
  updateProjectAgent,
  getProjectProviders,
  getProjectSkills,
  getProjectMcps,
  getProjectRestTools,
  getProjectRestToolSources,
  getProjectKnowledge,
  getProjectStores,
} from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  "productivity",
  "coding",
  "creative",
  "research",
  "roleplay",
  "other",
];

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.persona.hasanraiyan.me/api/v1";
// Matches architectConstants.js's PROJECT_ARCHITECT_AGENT_ID on the
// backend — inert client-side (the backend route always targets this
// sentinel regardless of what's sent), kept in sync for clarity/debugging.
const PROJECT_ARCHITECT_AGENT_ID = "000000000000000000000001";

// Architect tool results are JSON strings shaped { status, agentId?, data? }
// — same shape as the Persona Architect's, since projectBuilder.tools.js
// mirrors builder.tools.js's payload construction exactly.
function agentIdFromToolOutput(output) {
  const raw = output?.agentId || output?.data?.id || output?.data?._id;
  return raw ? String(raw) : null;
}

function AttachmentPicker({ label, items, selected, onToggle, renderBadge }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.map((item) => {
            const id = item._id || item.id;
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(id)}
                  onCheckedChange={() => onToggle(id)}
                />
                <span className="flex-1">{item.name || item.label}</span>
                {renderBadge?.(item)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProjectAgentEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const agentId = params.agentId;
  const isEditing = agentId !== "new";
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [authToken, setAuthToken] = useState(null);
  const handledArchitectTools = useRef(new Set());

  const [providers, setProviders] = useState([]);
  const [skills, setSkills] = useState([]);
  const [mcps, setMcps] = useState([]);
  const [restApiTools, setRestApiTools] = useState([]);
  const [restApiToolSources, setRestApiToolSources] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [stores, setStores] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    providerId: "",
    modelName: "",
    category: "other",
    visibility: "private",
    webSearchEnabled: false,
    isActive: true,
    skills: [],
    mcps: [],
    restApiTools: [],
    restApiToolSources: [],
    knowledgeBases: [],
    storeMounts: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useDashboardHeader({
    title: isEditing ? "Edit Agent" : "Add Agent",
    description:
      "Configure an Agent this Project owns and exposes to its own users.",
    actions: (
      <Link
        href={developerRoutes.project(projectId)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
    ),
  });

  // The Architect chat talks over raw fetch (SSE), not the axios `api`
  // instance, so it needs its own Clerk token — same 40s refresh interval
  // as the Persona Sage builder page.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const refreshToken = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    };
    refreshToken();
    const interval = setInterval(refreshToken, 40000);
    return () => clearInterval(interval);
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    (async () => {
      try {
        const [
          providersRes,
          skillsRes,
          mcpsRes,
          restToolsRes,
          restToolSourcesRes,
          knowledgeRes,
          storesRes,
        ] = await Promise.all([
          getProjectProviders(projectId),
          getProjectSkills(projectId),
          getProjectMcps(projectId),
          getProjectRestTools(projectId),
          getProjectRestToolSources(projectId),
          getProjectKnowledge(projectId),
          getProjectStores(projectId),
        ]);
        setProviders(providersRes.data?.data || []);
        setSkills(skillsRes.data?.data || []);
        setMcps(mcpsRes.data?.data || []);
        setRestApiTools(restToolsRes.data?.data || []);
        setRestApiToolSources(restToolSourcesRes.data?.data || []);
        setKnowledgeBases(knowledgeRes.data?.data || []);
        setStores(storesRes.data?.data || []);

        if (isEditing) {
          const agentsRes = await getProjectAgents(projectId);
          const agents = agentsRes.data?.data || [];
          const agent = agents.find((a) => (a._id || a.id) === agentId);
          if (agent) {
            applyAgentToForm(agent);
          } else {
            toast.error("Agent not found");
            router.push(developerRoutes.project(projectId));
          }
        } else {
          const defaultProvider = (providersRes.data?.data || []).find(
            (p) => p.isDefault,
          );
          if (defaultProvider) {
            setFormData((prev) => ({
              ...prev,
              providerId: defaultProvider.id,
            }));
          }
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Agent.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, agentId, isEditing, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAttachment = (field, id) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((x) => x !== id)
        : [...prev[field], id],
    }));
  };

  const applyAgentToForm = (agent) => {
    setFormData({
      name: agent.name || "",
      description: agent.description || "",
      systemPrompt: agent.systemPrompt || "",
      providerId: agent.providerId || "",
      modelName: agent.modelName || "",
      category: agent.category || "other",
      visibility: agent.visibility || "private",
      webSearchEnabled: agent.webSearchEnabled || false,
      isActive: agent.isActive !== false,
      skills: (agent.skills || []).map((s) => s._id || s),
      mcps: (agent.mcps || []).map((m) => m._id || m),
      restApiTools: (agent.restApiTools || []).map((t) => t._id || t),
      restApiToolSources: (agent.restApiToolSources || []).map(
        (s) => s._id || s,
      ),
      knowledgeBases: (agent.knowledgeBases || []).map((k) => k._id || k),
      storeMounts: (agent.storeMounts || []).map((s) => s._id || s),
    });
  };

  const refreshAgentFromServer = useCallback(
    async (targetAgentId) => {
      try {
        const res = await getProjectAgents(projectId);
        const agents = res.data?.data || [];
        const agent = agents.find((a) => (a._id || a.id) === targetAgentId);
        if (agent) applyAgentToForm(agent);
      } catch (err) {
        console.error("Agent refresh failed", err);
      }
    },
    [projectId],
  );

  // Mirrors the Persona Sage builder page's handleArchitectToolResult:
  // upsert_agent's result tells us whether the Architect just created a new
  // Agent (switch this page into editing it) or updated the one already
  // open here (refresh the form to show what changed).
  const handleArchitectToolResult = useCallback(
    (tool) => {
      if (
        (tool.name !== "upsert_agent" && tool.name !== "get_agent") ||
        handledArchitectTools.current.has(tool.id)
      ) {
        return;
      }
      handledArchitectTools.current.add(tool.id);

      try {
        const output =
          typeof tool.resultText === "string"
            ? JSON.parse(tool.resultText)
            : tool.resultText;
        if (output?.status !== "success") return;

        const resultAgentId = agentIdFromToolOutput(output);
        if (!resultAgentId) return;

        if (tool.name === "get_agent") {
          if (isEditing && resultAgentId === String(agentId) && output.data) {
            applyAgentToForm(output.data);
          }
          return;
        }

        if (!isEditing) {
          toast.success("Agent created by the Architect");
          router.push(
            developerRoutes.projectAgentEdit(projectId, resultAgentId),
          );
          return;
        }

        if (resultAgentId === String(agentId)) {
          refreshAgentFromServer(agentId).then(() =>
            toast.success("Configuration synced"),
          );
        }
      } catch (err) {
        console.error("Failed to parse Architect tool output", err);
      }
    },
    [agentId, isEditing, projectId, refreshAgentFromServer, router],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.providerId) {
      toast.error("Add a Provider first — an Agent needs one.");
      return;
    }
    setSaving(true);
    try {
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.modelName) delete dataToSubmit.modelName;
      if (!dataToSubmit.description) delete dataToSubmit.description;

      if (isEditing) {
        await updateProjectAgent(projectId, agentId, dataToSubmit);
        toast.success("Agent updated.");
      } else {
        await createProjectAgent(projectId, dataToSubmit);
        toast.success("Agent created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Agent.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const runtimeUrl = `${BASE_URL}/projects/${projectId}/architect/agui`;

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] max-h-[calc(100vh-var(--header-height))] flex-col overflow-hidden p-4 md:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <Card className="flex h-[420px] w-full flex-col overflow-hidden lg:h-full lg:w-[380px] lg:shrink-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Project Agent Architect</CardTitle>
            <CardDescription>
              {isEditing
                ? "Tell it what to change about this Agent."
                : "Tell it what kind of Agent to build."}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            {authToken ? (
              <AguiAgentChat
                url={runtimeUrl}
                agentId={PROJECT_ARCHITECT_AGENT_ID}
                threadId={projectId}
                title="Architect"
                emptyTitle="Project Agent Architect"
                emptyDescription={
                  isEditing
                    ? "Tell it what you want to change about this Agent."
                    : "Tell it what kind of Agent this Project needs."
                }
                headers={{ Authorization: `Bearer ${authToken}` }}
                onToolResult={handleArchitectToolResult}
                showHeader={false}
                emptyStateVariant="simple"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
        >
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Owned by this Project — any of its Admins can manage it
                afterward. Use the Architect alongside this form, or fill it in
                yourself — either way works.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Support Assistant"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What does this Agent do?"
                    value={formData.description}
                    onChange={handleChange}
                    maxLength={500}
                    rows={2}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="systemPrompt">System Prompt</FieldLabel>
                  <Textarea
                    id="systemPrompt"
                    name="systemPrompt"
                    placeholder="The primary instructions defining this Agent's behavior..."
                    value={formData.systemPrompt}
                    onChange={handleChange}
                    required
                    minLength={10}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="providerId">Provider</FieldLabel>
                    <Select
                      value={formData.providerId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, providerId: value }))
                      }
                    >
                      <SelectTrigger id="providerId" className="w-full">
                        <SelectValue
                          placeholder={
                            providers.length > 0
                              ? "Select a Provider"
                              : "No Providers yet"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="modelName">Model</FieldLabel>
                    <Input
                      id="modelName"
                      name="modelName"
                      placeholder="Uses Provider's default"
                      value={formData.modelName}
                      onChange={handleChange}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
                    <Select
                      value={formData.visibility}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, visibility: value }))
                      }
                    >
                      <SelectTrigger id="visibility" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="unlisted">Unlisted</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Within this Project&apos;s own Domain.
                    </FieldDescription>
                  </Field>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Web search</p>
                    <p className="text-sm text-muted-foreground">
                      Let this Agent search the web when needed.
                    </p>
                  </div>
                  <Switch
                    checked={formData.webSearchEnabled}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        webSearchEnabled: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-sm text-muted-foreground">
                      Inactive Agents cannot be executed.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <AttachmentPicker
                    label="Skills"
                    items={skills}
                    selected={formData.skills}
                    onToggle={(id) => toggleAttachment("skills", id)}
                  />
                  <AttachmentPicker
                    label="MCP Connectors"
                    items={mcps}
                    selected={formData.mcps}
                    onToggle={(id) => toggleAttachment("mcps", id)}
                    renderBadge={(mcp) => (
                      <span className="text-xs text-muted-foreground">
                        {mcp.authMode}
                      </span>
                    )}
                  />
                  <AttachmentPicker
                    label="REST API Tools"
                    items={restApiTools}
                    selected={formData.restApiTools}
                    onToggle={(id) => toggleAttachment("restApiTools", id)}
                    renderBadge={(tool) => (
                      <span className="text-xs text-muted-foreground">
                        {tool.method}
                      </span>
                    )}
                  />
                  <AttachmentPicker
                    label="REST Tool Sources"
                    items={restApiToolSources}
                    selected={formData.restApiToolSources}
                    onToggle={(id) =>
                      toggleAttachment("restApiToolSources", id)
                    }
                    renderBadge={(source) => (
                      <span className="text-xs text-muted-foreground">
                        {(source.tools || []).length} tool
                        {(source.tools || []).length === 1 ? "" : "s"}
                      </span>
                    )}
                  />
                  <AttachmentPicker
                    label="Knowledge Bases"
                    items={knowledgeBases}
                    selected={formData.knowledgeBases}
                    onToggle={(id) => toggleAttachment("knowledgeBases", id)}
                  />
                  <AttachmentPicker
                    label="Stores"
                    items={stores}
                    selected={formData.storeMounts}
                    onToggle={(id) => toggleAttachment("storeMounts", id)}
                    renderBadge={(store) => (
                      <span className="text-xs text-muted-foreground">
                        {store.scope}
                        {store.accessMode === "readonly" ? " · read-only" : ""}
                      </span>
                    )}
                  />
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <Link href={developerRoutes.project(projectId)}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving} className="shadow-sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Agent" : "Create Agent"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
