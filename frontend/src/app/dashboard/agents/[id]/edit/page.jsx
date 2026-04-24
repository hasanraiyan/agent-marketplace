"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2, Play } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { getAgent, updateAgent, deleteAgent } from "@/lib/api/agents";
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
];

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [providers, setProviders] = useState([]);
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
    const loadData = async () => {
      try {
        const [agentRes, providersRes] = await Promise.all([
          getAgent(agentId),
          getProviders(),
        ]);
        const agent = agentRes.data?.data;
        const providersList = providersRes.data?.data || [];
        setProviders(providersList);

        if (agent) {
          setForm({
            name: agent.name || "",
            description: agent.description || "",
            avatar: agent.avatar || "",
            tags: agent.tags || [],
            systemPrompt: agent.systemPrompt || "",
            providerId: agent.providerId || "",
            modelName: agent.modelName || "",
            webSearchEnabled: agent.webSearchEnabled || false,
            visibility: agent.visibility || "private",
            category: agent.category || "other",
            isActive: agent.isActive !== false,
          });
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load agent");
        router.push("/dashboard/agents");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [agentId, router]);

  useEffect(() => {
    if (!form.providerId) return;
    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const res = await getProviderModels(form.providerId);
        setModels(res.data?.data?.models || res.data?.data || []);
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

      await updateAgent(agentId, payload);
      toast.success("Agent updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAgent(agentId);
      toast.success("Agent deleted");
      router.push("/dashboard/agents");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete agent");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-start justify-between gap-4 px-4 lg:px-6">
          <div>
            <Link
              href="/dashboard/agents"
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to My Agents
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Edit Agent</h1>
            <p className="text-muted-foreground">
              Update your agent&apos;s configuration.
            </p>
          </div>
          <Link href={`/dashboard/agents/${agentId}/run`}>
            <Button variant="outline">
              <Play data-icon="inline-start" />
              Run Agent
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="px-4 lg:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Name, description, and category.
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
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="description">Description</FieldLabel>
                      <Textarea
                        id="description"
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
                        value={form.avatar}
                        onChange={(e) => update("avatar", e.target.value)}
                      />
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
                        value={form.systemPrompt}
                        onChange={(e) => update("systemPrompt", e.target.value)}
                        rows={8}
                        required
                      />
                      <FieldDescription>
                        Shapes the agent&apos;s personality and capabilities.
                      </FieldDescription>
                    </Field>

                    <Field orientation="horizontal">
                      <Switch
                        id="webSearchEnabled"
                        checked={form.webSearchEnabled}
                        onCheckedChange={(v) => update("webSearchEnabled", v)}
                      />
                      <div>
                        <FieldLabel htmlFor="webSearchEnabled">
                          Web Search
                        </FieldLabel>
                        <FieldDescription>
                          Allow the agent to search the web.
                        </FieldDescription>
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="mt-6 border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-destructive">
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Deleting this agent is permanent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete Agent
                  </Button>
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
                          if (p?.defaultModel && !form.modelName) {
                            update("modelName", p.defaultModel);
                          }
                        }}
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
                              loadingModels ? "Loading..." : "Select a model"
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
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{form.name}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
