"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { createAgent } from "@/lib/api/agents";
import { getProviders, getProviderModels } from "@/lib/api/providers";

const CATEGORIES = [
  { value: "productivity", label: "Productivity" },
  { value: "coding", label: "Coding" },
  { value: "creative", label: "Creative" },
  { value: "research", label: "Research" },
  { value: "roleplay", label: "Roleplay" },
  { value: "other", label: "Other" },
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (only you)" },
  { value: "unlisted", label: "Unlisted (anyone with link)" },
  { value: "public", label: "Public (marketplace)" },
];

export default function CreateAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    avatar: "",
    tags: [],
    systemPrompt: "",
    providerId: "",
    modelName: "",
    webSearchEnabled: false,
    visibility: "private",
    category: "other",
    isActive: true,
  });

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await getProviders();
        const list = res.data?.data || [];
        setProviders(list);
        const defaultProvider =
          list.find((p) => p.isDefault) || list[0] || null;
        if (defaultProvider) {
          setForm((prev) => ({
            ...prev,
            providerId: defaultProvider.id || defaultProvider._id,
            modelName: defaultProvider.defaultModel || "",
          }));
        }
      } catch (err) {
        toast.error("Failed to load providers");
      } finally {
        setLoadingProviders(false);
      }
    };
    loadProviders();
  }, []);

  useEffect(() => {
    if (!form.providerId) {
      setModels([]);
      return;
    }
    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const res = await getProviderModels(form.providerId);
        const fetched = res.data?.data?.models || res.data?.data || [];
        setModels(fetched);
      } catch (err) {
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, [form.providerId]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTag = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagsInput.trim().replace(/,$/, "");
      if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
        update("tags", [...form.tags, tag]);
      }
      setTagsInput("");
    }
  };

  const removeTag = (tag) => {
    update(
      "tags",
      form.tags.filter((t) => t !== tag),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.providerId) {
      toast.error("Please select a provider");
      return;
    }
    if (form.systemPrompt.length < 10) {
      toast.error("System prompt must be at least 10 characters");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.avatar) delete payload.avatar;
      if (!payload.modelName) delete payload.modelName;
      if (!payload.description) delete payload.description;

      const res = await createAgent(payload);
      toast.success("Agent created successfully");
      const newAgent = res.data?.data;
      const newId = newAgent?.id || newAgent?._id;
      if (newId) {
        router.push(`/dashboard/agents/${newId}/edit`);
      } else {
        router.push("/dashboard/agents");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <Link
            href="/dashboard/agents"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to My Agents
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Create Agent</h1>
          <p className="text-muted-foreground">
            Configure a new AI agent with your provider and system prompt.
          </p>
        </div>

        {!loadingProviders && providers.length === 0 && (
          <div className="px-4 lg:px-6">
            <Alert>
              <AlertTitle>No providers configured</AlertTitle>
              <AlertDescription>
                You need to set up an AI provider before creating an agent.{" "}
                <Link
                  href="/dashboard/settings"
                  className="font-medium underline"
                >
                  Go to Settings
                </Link>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-4 lg:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Name, description, and category for your agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        id="name"
                        placeholder="e.g. Research Assistant"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        required
                        maxLength={100}
                      />
                      <FieldDescription>
                        Between 2 and 100 characters.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="description">Description</FieldLabel>
                      <Textarea
                        id="description"
                        placeholder="What does this agent do?"
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                        maxLength={500}
                        rows={3}
                      />
                      <FieldDescription>
                        {form.description.length}/500 characters
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="category">Category</FieldLabel>
                      <Select
                        value={form.category}
                        onValueChange={(v) => update("category", v)}
                      >
                        <SelectTrigger id="category">
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
                      <FieldLabel htmlFor="tags">Tags</FieldLabel>
                      <Input
                        id="tags"
                        placeholder="Type a tag and press Enter"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        onKeyDown={addTag}
                      />
                      <FieldDescription>
                        Press Enter or comma to add. Max 10 tags.
                      </FieldDescription>
                      {form.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {form.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => removeTag(tag)}
                            >
                              {tag} ×
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="avatar">Avatar URL</FieldLabel>
                      <Input
                        id="avatar"
                        type="url"
                        placeholder="https://..."
                        value={form.avatar}
                        onChange={(e) => update("avatar", e.target.value)}
                      />
                      <FieldDescription>Optional image URL.</FieldDescription>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Behavior</CardTitle>
                  <CardDescription>
                    Define how the agent thinks and responds.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="systemPrompt">
                        System Prompt
                      </FieldLabel>
                      <Textarea
                        id="systemPrompt"
                        placeholder="You are a helpful assistant that..."
                        value={form.systemPrompt}
                        onChange={(e) =>
                          update("systemPrompt", e.target.value)
                        }
                        rows={8}
                        required
                      />
                      <FieldDescription>
                        At least 10 characters. Shapes the agent's personality
                        and capabilities.
                      </FieldDescription>
                    </Field>

                    <Field orientation="horizontal">
                      <Switch
                        id="webSearchEnabled"
                        checked={form.webSearchEnabled}
                        onCheckedChange={(v) =>
                          update("webSearchEnabled", v)
                        }
                      />
                      <div>
                        <FieldLabel htmlFor="webSearchEnabled">
                          Web Search
                        </FieldLabel>
                        <FieldDescription>
                          Allow the agent to search the web for information.
                        </FieldDescription>
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Model</CardTitle>
                  <CardDescription>
                    Provider and model that power this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="provider">Provider</FieldLabel>
                      <Select
                        value={form.providerId}
                        onValueChange={(v) => {
                          update("providerId", v);
                          const p = providers.find(
                            (pr) => (pr.id || pr._id) === v,
                          );
                          update("modelName", p?.defaultModel || "");
                        }}
                        disabled={loadingProviders || providers.length === 0}
                      >
                        <SelectTrigger id="provider">
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => (
                            <SelectItem
                              key={p.id || p._id}
                              value={p.id || p._id}
                            >
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="model">Model</FieldLabel>
                      <Select
                        value={form.modelName}
                        onValueChange={(v) => update("modelName", v)}
                        disabled={!form.providerId || loadingModels}
                      >
                        <SelectTrigger id="model">
                          <SelectValue
                            placeholder={
                              loadingModels
                                ? "Loading..."
                                : "Select a model"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {models.length > 0 ? (
                            models.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.id}
                              </SelectItem>
                            ))
                          ) : form.modelName ? (
                            <SelectItem value={form.modelName}>
                              {form.modelName}
                            </SelectItem>
                          ) : (
                            <SelectItem value="none" disabled>
                              No models available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Uses provider default if not specified.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visibility</CardTitle>
                  <CardDescription>
                    Who can discover and use this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
                      <Select
                        value={form.visibility}
                        onValueChange={(v) => update("visibility", v)}
                      >
                        <SelectTrigger id="visibility">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIBILITY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field orientation="horizontal">
                      <Switch
                        id="isActive"
                        checked={form.isActive}
                        onCheckedChange={(v) => update("isActive", v)}
                      />
                      <div>
                        <FieldLabel htmlFor="isActive">Active</FieldLabel>
                        <FieldDescription>
                          Inactive agents cannot be run.
                        </FieldDescription>
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={saving || providers.length === 0}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    "Create Agent"
                  )}
                </Button>
                <Link href="/dashboard/agents" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
