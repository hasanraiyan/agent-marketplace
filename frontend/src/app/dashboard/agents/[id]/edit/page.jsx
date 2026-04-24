"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Loader2, 
  Bot, 
  Sparkles, 
  Brain, 
  Lock, 
  Eye, 
  Info,
  CheckCircle2,
  Cpu,
  Trash2,
  Play,
  Save
} from "lucide-react";
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
import { AgentExploreCard } from "@/components/agents/agent-explore-card";

const CATEGORIES = [
  { value: "productivity", label: "Productivity", icon: "🚀" },
  { value: "coding", label: "Coding", icon: "💻" },
  { value: "creative", label: "Creative", icon: "🎨" },
  { value: "research", label: "Research", icon: "🔍" },
  { value: "roleplay", label: "Roleplay", icon: "🎭" },
  { value: "other", label: "Other", icon: "✨" },
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", description: "Only you can see and use this agent", icon: Lock },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can use it", icon: Eye },
  { value: "public", label: "Public", description: "Visible on the Explore dashboard for everyone", icon: Globe },
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
      toast.success("Agent updated successfully");
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
      <div className="flex flex-1 flex-col @container/main">
        <header className="h-16 border-b bg-muted/20 animate-pulse" />
        <div className="grid flex-1 lg:grid-cols-12">
            <div className="lg:col-span-8 p-8 space-y-8">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-4 border-l bg-muted/5 p-8 hidden lg:block">
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        </div>
      </div>
    );
  }

  // Live preview data
  const previewAgent = {
    ...form,
    avatarUrl: form.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(form.name || 'agent')}`,
    messageCount: 0
  };

  return (
    <div className="flex flex-1 flex-col @container/main">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/agents">
              <Button variant="ghost" size="icon" className="size-8">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold leading-none">Edit Agent</h1>
              <p className="mt-1 text-xs text-muted-foreground">Managing {form.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/agents/${agentId}/run`}>
                <Button variant="outline" size="sm">
                    <Play className="mr-2 size-3.5 fill-current" />
                    Launch
                </Button>
            </Link>
            <Button 
              size="sm" 
              onClick={handleSubmit} 
              disabled={saving}
              className="glow-primary"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-0 lg:grid-cols-12">
        {/* Form Area */}
        <main className="lg:col-span-7 xl:col-span-8 p-4 lg:p-8 space-y-8">
          
          {/* Section: Identity */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Bot className="size-5 text-primary" />
              <h2 className="text-xl font-bold">Identity</h2>
            </div>
            
            <div className="grid gap-6">
              <Field>
                <FieldLabel className="text-sm font-bold">Name</FieldLabel>
                <Input
                  placeholder="e.g. Research Assistant"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="h-11 bg-muted/30 focus-visible:bg-background transition-colors"
                  required
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-sm font-bold">Category</FieldLabel>
                  <Select value={form.category} onValueChange={(v) => update("category", v)}>
                    <SelectTrigger className="h-11 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="mr-2">{c.icon}</span> {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel className="text-sm font-bold">Avatar URL</FieldLabel>
                  <Input
                    type="url"
                    placeholder="https://images.com/..."
                    value={form.avatar}
                    onChange={(e) => update("avatar", e.target.value)}
                    className="h-11 bg-muted/30"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel className="text-sm font-bold">Description</FieldLabel>
                <Textarea
                  placeholder="Tell us what this agent specializes in..."
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={3}
                  className="bg-muted/30 focus-visible:bg-background"
                />
                <div className="flex justify-between mt-1">
                  <FieldDescription>A brief summary for discovery.</FieldDescription>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{form.description.length}/500</span>
                </div>
              </Field>

              <Field>
                <FieldLabel className="text-sm font-bold">Tags</FieldLabel>
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="productivity, help, coding..."
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    onKeyDown={addTag}
                    className="bg-muted/30"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          </section>

          {/* Section: Intelligence */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Brain className="size-5 text-primary" />
              <h2 className="text-xl font-bold">Intelligence</h2>
            </div>

            <div className="grid gap-6">
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-sm font-bold">System Prompt</FieldLabel>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold text-muted-foreground">Required</Badge>
                </div>
                <Textarea
                  placeholder="You are a professional assistant that..."
                  value={form.systemPrompt}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                  rows={10}
                  className="font-mono text-sm bg-muted/30 focus-visible:bg-background leading-relaxed"
                />
              </Field>

              <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 ring-1 ring-foreground/5 transition-all hover:ring-primary/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <FieldLabel className="flex items-center gap-2 font-bold">
                      Web Search Capability
                      <Badge variant="secondary" className="h-5 px-1.5 text-[9px] uppercase tracking-tighter">Pro</Badge>
                    </FieldLabel>
                    <FieldDescription>Allow the agent to browse the internet for real-time data.</FieldDescription>
                  </div>
                  <Switch
                    checked={form.webSearchEnabled}
                    onCheckedChange={(v) => update("webSearchEnabled", v)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Infrastructure */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Cpu className="size-5 text-primary" />
              <h2 className="text-xl font-bold">Model Settings</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel className="text-sm font-bold">AI Provider</FieldLabel>
                <Select value={form.providerId} onValueChange={(v) => update("providerId", v)}>
                  <SelectTrigger className="h-11 bg-muted/30">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id || p._id} value={p.id || p._id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel className="text-sm font-bold">Model</FieldLabel>
                <Select value={form.modelName} onValueChange={(v) => update("modelName", v)} disabled={loadingModels}>
                  <SelectTrigger className="h-11 bg-muted/30">
                    <SelectValue placeholder={loadingModels ? "Loading..." : "Select Model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          {/* Section: Visibility */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Lock className="size-5 text-primary" />
              <h2 className="text-xl font-bold">Access & Visibility</h2>
            </div>

            <div className="grid gap-4">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("visibility", opt.value)}
                  className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                    form.visibility === opt.value 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className={`mt-0.5 rounded-lg p-2 ${form.visibility === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <opt.icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{opt.label}</p>
                      {form.visibility === opt.value && <CheckCircle2 className="size-4 text-primary" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 ring-1 ring-foreground/5 transition-all hover:ring-primary/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <FieldLabel className="flex items-center gap-2 font-bold">
                      Active Status
                    </FieldLabel>
                    <FieldDescription>Allow or prevent users from running this agent.</FieldDescription>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => update("isActive", v)}
                  />
                </div>
              </div>
          </section>

          {/* Section: Danger Zone */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Trash2 className="size-5 text-destructive" />
              <h2 className="text-xl font-bold text-destructive">Danger Zone</h2>
            </div>

            <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <p className="font-bold">Delete this agent</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Once deleted, all configuration and associated data will be permanently removed.
                            </p>
                        </div>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => setDeleteOpen(true)}
                            className="w-full sm:w-auto"
                        >
                            Delete Agent
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </section>

          <div className="pt-6 border-t">
              <Button 
                onClick={handleSubmit} 
                className="w-full h-12 text-base glow-primary"
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
                Save Agent Changes
              </Button>
          </div>
        </main>

        {/* Preview Sidebar */}
        <aside className="lg:col-span-5 xl:col-span-4 sticky top-16 hidden lg:block border-l h-[calc(100vh-64px)] bg-muted/10 overflow-hidden">
          <div className="p-8 h-full flex flex-col items-center">
            <div className="mb-8 text-center space-y-2">
                <Badge variant="secondary" className="px-3 py-1 font-bold">Live Preview</Badge>
                <p className="text-sm text-muted-foreground px-8">Previewing changes for {form.name || "Untitled"}.</p>
            </div>
            
            <div className="w-full max-w-[320px] scale-110 origin-top">
                <AgentExploreCard agent={previewAgent} />
            </div>

            <div className="mt-auto w-full p-6 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex gap-3">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Info className="size-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Usage Stats</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            This agent has been used in 0 chats.
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </aside>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{form.name}</span>. This action
              cannot be undone and all associated configuration will be lost.
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
