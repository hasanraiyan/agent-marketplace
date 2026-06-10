"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Brain,
  Code,
  Drama,
  Lock,
  Eye,
  Globe,
  Cpu,
  Loader2,
  Palette,
  Plug,
  Rocket,
  Check,
  ChevronDown,
  Save,
  Search,
  Sparkles,
  CheckCircle2,
  X,
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
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getProviders, getProviderModels } from "@/lib/api/providers";
import { getMySkills } from "@/lib/api/skills";

const CATEGORIES = [
  { value: "productivity", label: "Productivity", icon: Rocket },
  { value: "coding", label: "Coding", icon: Code },
  { value: "creative", label: "Creative", icon: Palette },
  { value: "research", label: "Research", icon: Search },
  { value: "roleplay", label: "Roleplay", icon: Drama },
  { value: "other", label: "Other", icon: Sparkles },
];

const VISIBILITY_OPTIONS = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see and use this agent",
    icon: Lock,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link can use it",
    icon: Eye,
  },
  {
    value: "public",
    label: "Public",
    description: "Visible on the Explore dashboard",
    icon: Globe,
  },
];

const DEFAULT_FORM = {
  name: "",
  description: "",
  avatar: "",
  tags: [],
  skills: [],
  systemPrompt: "",
  providerId: "",
  modelName: "",
  webSearchEnabled: false,
  visibility: "private",
  category: "other",
  isActive: true,
};

export function AgentForm({
  mode = "create",
  initialData,
  onSave,
  loading: saving,
}) {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);

  // Explicit, mode-aware initialization: hydrate from initialData when editing,
  // reset to a clean slate when the form transitions back to create/empty. The
  // reset only fires on an actual mode/initialData change — never on mount or
  // effect replays — so it cannot clobber the async-loaded provider defaults.
  const prevInitRef = useRef({ mode, initialData });
  useEffect(() => {
    const prev = prevInitRef.current;
    const changed = prev.mode !== mode || prev.initialData !== initialData;
    prevInitRef.current = { mode, initialData };

    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        avatar: initialData.avatar || "",
        tags: initialData.tags || [],
        skills: (initialData.skills || []).map((s) => s._id || s.id || s),
        systemPrompt: initialData.systemPrompt || "",
        providerId: initialData.providerId || "",
        modelName: initialData.modelName || "",
        webSearchEnabled: initialData.webSearchEnabled || false,
        visibility: initialData.visibility || "private",
        category: initialData.category || "other",
        isActive: initialData.isActive !== false,
      });
    } else if (changed) {
      setForm(DEFAULT_FORM);
    }
  }, [initialData, mode]);

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const res = await getMySkills();
        setAvailableSkills(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load skills");
      } finally {
        setLoadingSkills(false);
      }
    };
    loadSkills();

    const loadProviders = async () => {
      try {
        const res = await getProviders();
        const list = res.data?.data || [];
        setProviders(list);

        // Use functional update to check the CURRENT providerId state
        setForm((prev) => {
          if (!prev.providerId && list.length > 0) {
            const defaultProvider = list.find((p) => p.isDefault) || list[0];
            return {
              ...prev,
              providerId: defaultProvider.id || defaultProvider._id,
              modelName: prev.modelName || defaultProvider.defaultModel || "",
            };
          }
          return prev;
        });
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

        // If no model is selected yet, prefer the provider's default model
        // when it exists in the fetched list.
        setForm((prev) => {
          if (prev.modelName) return prev;
          const provider = providers.find(
            (p) => (p.id || p._id) === prev.providerId,
          );
          const defaultModel = provider?.defaultModel;
          if (defaultModel && fetched.some((m) => m.id === defaultModel)) {
            return { ...prev, modelName: defaultModel };
          }
          return prev;
        });
      } catch (err) {
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.providerId]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // A model only makes sense for the provider it belongs to, so switching
  // providers clears the selection until the new model list loads.
  const changeProvider = (providerId) => {
    setForm((prev) => {
      if (prev.providerId === providerId) return prev;
      return { ...prev, providerId, modelName: "" };
    });
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

  const toggleSkill = (skillId) => {
    const current = form.skills || [];
    if (current.includes(skillId)) {
      update(
        "skills",
        current.filter((id) => id !== skillId),
      );
    } else {
      update("skills", [...current, skillId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Clean up empty strings for optional fields
    const sanitized = { ...form };
    if (!sanitized.description) delete sanitized.description;
    if (!sanitized.avatar) delete sanitized.avatar;
    if (!sanitized.modelName) delete sanitized.modelName;
    if (sanitized.tags?.length === 0) delete sanitized.tags;

    onSave(sanitized);
  };

  const noProviders = !loadingProviders && providers.length === 0;
  const saveDisabled =
    saving || loadingProviders || loadingModels || !form.providerId;

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-20">
      {/* Section: Identity */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Bot className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Identity
          </h2>
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
              <Select
                value={form.category}
                onValueChange={(v) => update("category", v)}
              >
                <SelectTrigger className="h-11 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <c.icon className="mr-2 size-4 text-muted-foreground" />
                      {c.label}
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
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </Field>
        </div>
      </section>

      {/* Section: Skills */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Cpu className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Skills</h2>
        </div>

        <div className="grid gap-4">
          <FieldDescription className="text-xs -mt-2">
            Attach specialized capabilities to this agent. Skills provide
            additional instructions and context.
          </FieldDescription>

          {loadingSkills ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading skills...
            </div>
          ) : availableSkills.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No skills created yet.
              </p>
              <Link href="/dashboard/skills">
                <Button variant="outline" size="sm">
                  Create a Skill
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {availableSkills.map((skill) => {
                const isSelected = (form.skills || []).includes(
                  skill.id || skill._id,
                );
                return (
                  <button
                    key={skill.id || skill._id}
                    type="button"
                    onClick={() => toggleSkill(skill.id || skill._id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">
                          {skill.name}
                        </p>
                        {isSelected && (
                          <Check className="size-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {skill.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section: Intelligence */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Brain className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Instructions
          </h2>
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
                <FieldDescription>
                  Allow the agent to search the web.
                </FieldDescription>
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
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Capabilities
          </h2>
        </div>

        {noProviders ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Plug className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-bold">No AI provider configured</p>
              <p className="text-muted-foreground">
                Add an LLM provider (API key) before creating an agent.
              </p>
              <Link
                href="/dashboard/settings"
                className="inline-block font-medium text-primary underline-offset-2 hover:underline"
              >
                Go to provider settings
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel className="text-sm font-bold">AI Provider</FieldLabel>
              <Select
                value={form.providerId}
                onValueChange={changeProvider}
                disabled={loadingProviders}
              >
                <SelectTrigger className="h-11 bg-muted/20">
                  <SelectValue
                    placeholder={
                      loadingProviders ? "Loading..." : "Select Provider"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id || p._id} value={p.id || p._id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel className="text-sm font-bold">Model</FieldLabel>
              <Select
                value={form.modelName}
                onValueChange={(v) => update("modelName", v)}
                disabled={loadingModels}
              >
                <SelectTrigger className="h-11 bg-muted/20">
                  <SelectValue
                    placeholder={loadingModels ? "Loading..." : "Select Model"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </section>

      {/* Section: Visibility */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Lock className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Visibility
          </h2>
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
              <div
                className={`mt-0.5 rounded-lg p-2 ${form.visibility === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                <opt.icon className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{opt.label}</p>
                  {form.visibility === opt.value && (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-tight">
                  {opt.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="pt-6">
        <Button
          type="submit"
          className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
          disabled={saveDisabled}
        >
          {saving ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : (
            <Save className="mr-2 size-5" />
          )}
          Save configuration
        </Button>
      </div>
    </form>
  );
}
