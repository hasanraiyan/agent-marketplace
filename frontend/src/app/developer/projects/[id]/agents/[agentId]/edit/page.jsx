"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  getProjectAgents,
  createProjectAgent,
  updateProjectAgent,
  getProjectProviders,
  getProjectSkills,
  getProjectMcps,
  getProjectKnowledge,
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

function AttachmentPicker({ label, items, selected, onToggle, renderBadge }) {
  return (
    <div className="space-y-2">
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

  const [providers, setProviders] = useState([]);
  const [skills, setSkills] = useState([]);
  const [mcps, setMcps] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);

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
    knowledgeBases: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useDashboardHeader({
    title: isEditing ? "Edit Agent" : "Add Agent",
    description:
      "Configure an Agent this Project owns and exposes to its own users.",
  });

  useEffect(() => {
    (async () => {
      try {
        const [providersRes, skillsRes, mcpsRes, knowledgeRes] =
          await Promise.all([
            getProjectProviders(projectId),
            getProjectSkills(projectId),
            getProjectMcps(projectId),
            getProjectKnowledge(projectId),
          ]);
        setProviders(providersRes.data?.data || []);
        setSkills(skillsRes.data?.data || []);
        setMcps(mcpsRes.data?.data || []);
        setKnowledgeBases(knowledgeRes.data?.data || []);

        if (isEditing) {
          const agentsRes = await getProjectAgents(projectId);
          const agents = agentsRes.data?.data || [];
          const agent = agents.find((a) => (a._id || a.id) === agentId);
          if (agent) {
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
              knowledgeBases: (agent.knowledgeBases || []).map(
                (k) => k._id || k,
              ),
            });
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
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href={developerRoutes.project(projectId)}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">
          {isEditing ? "Edit Agent" : "New Agent"}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
            <CardDescription>
              Owned by this Project — any of its Admins can manage it afterward.
              Want an AI co-pilot to build this instead? That lands in a
              follow-up.
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
                  label="Knowledge Bases"
                  items={knowledgeBases}
                  selected={formData.knowledgeBases}
                  onToggle={(id) => toggleAttachment("knowledgeBases", id)}
                />
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Agent" : "Create Agent"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
