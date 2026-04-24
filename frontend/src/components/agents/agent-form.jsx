"use client";

import { useState, useEffect } from "react";
import { 
  Bot, 
  Brain, 
  Lock, 
  Eye, 
  Globe,
  Cpu,
  Loader2,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getProviders, getProviderModels } from "@/lib/api/providers";

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
  { value: "public", label: "Public", description: "Visible on the Explore dashboard", icon: Globe },
];

export function AgentForm({ initialData, onSave, loading: saving, hideHeader = false }) {
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
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        avatar: initialData.avatar || "",
        tags: initialData.tags || [],
        systemPrompt: initialData.systemPrompt || "",
        providerId: initialData.providerId || "",
        modelName: initialData.modelName || "",
        webSearchEnabled: initialData.webSearchEnabled || false,
        visibility: initialData.visibility || "private",
        category: initialData.category || "other",
        isActive: initialData.isActive !== false,
      });
    }
  }, [initialData]);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await getProviders();
        const list = res.data?.data || [];
        setProviders(list);
        if (!form.providerId) {
            const defaultProvider = list.find((p) => p.isDefault) || list[0] || null;
            if (defaultProvider) {
                setForm((prev) => ({
                    ...prev,
                    providerId: defaultProvider.id || defaultProvider._id,
                    modelName: defaultProvider.defaultModel || "",
                }));
            }
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-20">
      {/* Section: Identity */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Bot className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Identity</h2>
        </div>
        
        <div className="grid gap-6">
          <Field>
            <FieldLabel className="text-sm font-bold">Agent Name</FieldLabel>
            <Input
              placeholder="e.g. Research Assistant"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="h-11 bg-muted/20"
              required
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel className="text-sm font-bold">Category</FieldLabel>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger className="h-11 bg-muted/20">
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
                className="h-11 bg-muted/20"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-sm font-bold">Description</FieldLabel>
            <Textarea
              placeholder="Tell us what this agent specializes in..."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              className="bg-muted/20"
            />
          </Field>

          <Field>
            <FieldLabel className="text-sm font-bold">Tags</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="productivity, help, coding..."
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={addTag}
                className="bg-muted/20"
              />
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">×</button>
                  </Badge>
                ))}
              </div>
            </div>
          </Field>
        </div>
      </section>

      {/* Section: Intelligence */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Brain className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Instructions</h2>
        </div>

        <div className="grid gap-6">
          <Field>
            <FieldLabel className="text-sm font-bold">System Prompt</FieldLabel>
            <Textarea
              placeholder="What does this GPT do? How does it behave? What should it avoid doing?"
              value={form.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              rows={12}
              className="font-mono text-sm bg-muted/20"
              required
            />
          </Field>

          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <FieldLabel className="flex items-center gap-2 font-bold">
                  Web Search
                </FieldLabel>
                <FieldDescription>Allow the agent to search the web.</FieldDescription>
              </div>
              <Switch
                checked={form.webSearchEnabled}
                onCheckedChange={(v) => update("webSearchEnabled", v)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section: Model Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Cpu className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Capabilities</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel className="text-sm font-bold">AI Provider</FieldLabel>
            <Select value={form.providerId} onValueChange={(v) => update("providerId", v)}>
              <SelectTrigger className="h-11 bg-muted/20">
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
              <SelectTrigger className="h-11 bg-muted/20">
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
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Lock className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Visibility</h2>
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
                  <p className="text-sm font-bold">{opt.label}</p>
                  {form.visibility === opt.value && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-tight">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="pt-6">
          <Button 
            type="submit"
            className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
            Save configuration
          </Button>
      </div>
    </form>
  );
}

function Save({ className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
}
