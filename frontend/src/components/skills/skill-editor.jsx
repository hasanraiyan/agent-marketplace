"use client";

import { studioRoutes, personaRoutes } from "@/lib/studio-routes";

import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Save,
  X,
  Check,
  Globe,
  Link2,
  Lock,
  Plus,
  Trash2,
  FileText,
  FileCode,
  FolderOpen,
  Compass,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { SkillCover, skillCategoryLabel } from "@/components/skills/skill-cover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createSkill, updateSkill } from "@/lib/api/skills";
import { useRouter } from "next/navigation";
import { useConnectors } from "@/components/connectors/connectors-context";
import Link from "next/link";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism.css";

const DEFAULT_FORM = {
  name: "",
  title: "",
  hook: "",
  coverImage: "",
  category: "other",
  tags: [],
  visibility: "private",
  description: "",
  instructions: "",
  files: [],
};

const SKILL_CATEGORIES = [
  "entrepreneurship",
  "health-fitness",
  "mind-behavior",
  "technology",
  "life-relationships",
  "careers",
  "other",
];

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    hint: "Listed on Explore, anyone can play it",
    icon: Globe,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Only people with the link",
    icon: Link2,
  },
  {
    value: "private",
    label: "Private",
    hint: "Only you and your agents",
    icon: Lock,
  },
];

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;
const MAX_HOOK_LENGTH = 200;
const MAX_TITLE_LENGTH = 120;
const MAX_SLUG_LENGTH = 64;

/** lowercase, non-alphanumerics → '-', trimmed dashes, ≤64 chars */
function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

function normalizeVisibility(skillLike) {
  const v = skillLike?.visibility;
  if (v === "public" || v === "unlisted" || v === "private") return v;
  return skillLike?.isPublic ? "public" : "private";
}

// Mirrors the backend limits in utils/skillValidation.js
const MAX_FILE_COUNT = 50;
const MAX_FILE_BYTES = 200_000;

const EXT_TO_LANGUAGE = {
  md: "markdown",
  markdown: "markdown",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  bash: "bash",
  html: "markup",
  htm: "markup",
  xml: "markup",
  css: "css",
};

const escapeHtml = (code) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightForPath(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  const grammar = languages[EXT_TO_LANGUAGE[ext]];
  return (code) => (grammar ? highlight(code, grammar) : escapeHtml(code));
}

/**
 * Client-side mirror of the backend's normalizeSkillFilePath: relative POSIX
 * path, no traversal, no leading slash. Returns null when unusable.
 */
function validateFilePath(rawPath) {
  const path = String(rawPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!path || path.length > 256) return null;
  const segments = path.split("/");
  if (segments.some((s) => !s || s === "." || s === "..")) return null;
  if (path.toUpperCase() === "SKILL.MD") return null;
  return path;
}

function normalizeSkillToForm(skill) {
  if (!skill) return DEFAULT_FORM;
  const files =
    skill.files?.length > 0
      ? skill.files.map((f) => ({ path: f.path, content: f.content ?? "" }))
      : (skill.codeSnippets || []).map((s) => ({
          path: s.filename,
          content: s.code ?? "",
        }));
  return {
    name: skill.name || "",
    title: skill.title || "",
    hook: skill.hook || "",
    coverImage: skill.coverImage || "",
    category: SKILL_CATEGORIES.includes(skill.category)
      ? skill.category
      : "other",
    tags: Array.isArray(skill.tags) ? skill.tags.filter(Boolean) : [],
    visibility: normalizeVisibility(skill),
    description: skill.description || "",
    instructions: skill.instructions || "",
    files,
  };
}

function FileIcon({ path, className }) {
  const ext = path.split(".").pop()?.toLowerCase();
  const Icon =
    ext === "md" || ext === "markdown" || ext === "txt" ? FileText : FileCode;
  return <Icon className={className} />;
}

export function SkillEditor({ skill, mode = "edit" }) {
  const router = useRouter();
  const { refreshSkills } = useConnectors();
  const [form, setForm] = useState(() =>
    skill ? normalizeSkillToForm(skill) : DEFAULT_FORM,
  );
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // null = SKILL.md (pinned), otherwise index into form.files
  const [activeFile, setActiveFile] = useState(null);
  const [addingFile, setAddingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [tagInput, setTagInput] = useState("");
  // True while the slug is empty or was last derived from the title, so typing
  // a title keeps suggesting a slug until the creator edits the slug by hand.
  const slugIsAuto = useRef(!skill?.name);

  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      // Load draft from localStorage if creating new skill
      if (mode === "new") {
        const saved = localStorage.getItem("skill_draft");
        if (saved) {
          try {
            const { isPublic, ...draft } = JSON.parse(saved);
            const merged = { ...DEFAULT_FORM, ...draft };
            merged.visibility = normalizeVisibility({
              visibility: draft.visibility,
              isPublic,
            });
            if (!Array.isArray(merged.tags)) merged.tags = [];
            if (!SKILL_CATEGORIES.includes(merged.category)) {
              merged.category = "other";
            }
            slugIsAuto.current =
              !merged.name || merged.name === slugify(merged.title);
            setForm(merged);
            setIsDirty(true);
          } catch (e) {
            console.error("Failed to load draft");
          }
        }
      }
    }
  }, [mode]);

  useEffect(() => {
    if (isDirty && mode === "new") {
      localStorage.setItem("skill_draft", JSON.stringify(form));
    }
  }, [form, isDirty, mode]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleNameChange = (val) => {
    const formatted = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-/, "")
      .slice(0, MAX_SLUG_LENGTH);
    slugIsAuto.current = formatted.length === 0;
    update("name", formatted);
  };

  const handleTitleChange = (val) => {
    const title = val.slice(0, MAX_TITLE_LENGTH);
    setForm((prev) => {
      const next = { ...prev, title };
      if (slugIsAuto.current || !prev.name) {
        next.name = slugify(title);
        slugIsAuto.current = true;
      }
      return next;
    });
    setIsDirty(true);
  };

  const addTag = (raw) => {
    const tag = String(raw || "")
      .trim()
      .replace(/,+$/, "")
      .slice(0, MAX_TAG_LENGTH);
    if (!tag) return;
    if (form.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    if (form.tags.length >= MAX_TAGS) {
      toast.error(`You can add up to ${MAX_TAGS} tags`);
      return;
    }
    update("tags", [...form.tags, tag]);
    setTagInput("");
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && form.tags.length > 0) {
      update("tags", form.tags.slice(0, -1));
    }
  };

  const removeTag = (tag) => {
    update(
      "tags",
      form.tags.filter((t) => t !== tag),
    );
  };

  const updateFile = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      files: prev.files.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
    setIsDirty(true);
  };

  const handleAddFile = () => {
    const path = validateFilePath(newFilePath);
    if (!path) {
      toast.error(
        "Invalid file path. Use a relative path like references/guide.md",
      );
      return;
    }
    if (form.files.some((f) => f.path === path)) {
      toast.error("A file with this path already exists");
      return;
    }
    if (form.files.length >= MAX_FILE_COUNT) {
      toast.error(`A skill can bundle at most ${MAX_FILE_COUNT} files`);
      return;
    }
    update("files", [...form.files, { path, content: "" }]);
    setActiveFile(form.files.length);
    setNewFilePath("");
    setAddingFile(false);
  };

  const handleRenameFile = (index, rawPath) => {
    // Allow free typing; validity is enforced on save
    updateFile(index, { path: rawPath });
  };

  const handleDeleteFile = (index) => {
    update(
      "files",
      form.files.filter((_, i) => i !== index),
    );
    setActiveFile(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.description || !form.instructions) {
      toast.error("Please fill in all required fields");
      return;
    }

    const files = [];
    for (const file of form.files) {
      const path = validateFilePath(file.path);
      if (!path) {
        toast.error(`Invalid file path: "${file.path}"`);
        return;
      }
      if (files.some((f) => f.path === path)) {
        toast.error(`Duplicate file path: "${path}"`);
        return;
      }
      if (new Blob([file.content]).size > MAX_FILE_BYTES) {
        toast.error(`"${path}" exceeds the 200KB per-file limit`);
        return;
      }
      files.push({ path, content: file.content });
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        title: form.title.trim(),
        hook: form.hook.trim(),
        coverImage: form.coverImage.trim(),
        category: form.category,
        tags: form.tags,
        visibility: form.visibility,
        description: form.description,
        instructions: form.instructions,
        files,
      };
      let res;
      if (mode === "edit") {
        res = await updateSkill(skill._id || skill.id, payload);
        toast.success("Skill updated successfully");
      } else {
        res = await createSkill(payload);
        toast.success("Skill created successfully");
        localStorage.removeItem("skill_draft");
      }

      const newSkillId = res.data?.data?._id || res.data?.data?.id;
      setIsDirty(false);
      refreshSkills();
      router.push(studioRoutes.skill(newSkillId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save skill");
    } finally {
      setLoading(false);
    }
  };

  const activeEntry = activeFile != null ? form.files[activeFile] : null;
  const activeContent = activeEntry ? activeEntry.content : form.instructions;
  const activePath = activeEntry ? activeEntry.path : "SKILL.md";

  const skillId = skill?._id || skill?.id;
  const personaId = skill?.persona?._id || skill?.persona?.id;
  const isPublishedPublic =
    mode === "edit" && normalizeVisibility(skill) === "public";
  const coverPreviewSkill = {
    title: form.title || form.name,
    name: form.name,
    category: form.category,
    coverImage: form.coverImage.trim(),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Cpu className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {mode === "new" ? "Create Skill" : "Edit Skill"}
            </h1>
            {isDirty && (
              <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider animate-pulse">
                Unsaved Changes
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPublishedPublic && (
            <div className="hidden sm:flex items-center gap-1 mr-1 text-[11px] font-semibold">
              <Link
                href={personaRoutes.explore}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-150/60 dark:border-zinc-800 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <Compass className="size-3" />
                View on Explore
              </Link>
              {personaId && (
                <Link
                  href={`/dashboard/agents/${personaId}/run?skill=${skillId}&threadId=new`}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Play className="size-3" />
                  Play it
                </Link>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" asChild disabled={loading}>
            <Link
              href={
                mode === "edit"
                  ? studioRoutes.skill(skill._id || skill.id)
                  : studioRoutes.skills
              }
            >
              <X className="size-4 mr-2" />
              Cancel
            </Link>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? (
              <div className="size-4 border-2 border-primary-foreground border-t-transparent animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {mode === "new" ? "Create Skill" : "Save Changes"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-10 pb-20">
          {/* Section: General Info - grid layout from agent-form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">General Information</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a unique name and descriptive summary for your skill.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Field>
                <FieldLabel className="text-sm font-bold">
                  Skill Name
                </FieldLabel>
                <Input
                  placeholder="e.g. data-analysis"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="font-mono text-sm bg-muted/20"
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Check className="size-3 text-green-500" />
                  Runtime slug, saved as:{" "}
                  <code className="bg-muted px-1 rounded">
                    {form.name || "..."}
                  </code>
                  {slugIsAuto.current && form.title ? (
                    <span className="text-muted-foreground/70">
                      (suggested from title)
                    </span>
                  ) : null}
                </p>
              </Field>

              <Field>
                <FieldLabel className="text-sm font-bold">
                  Description
                </FieldLabel>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    What does this skill do, and when should the agent use it?
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      form.description.length > 1000
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {form.description.length} / 1024
                  </span>
                </div>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    update("description", e.target.value.slice(0, 1024))
                  }
                  rows={3}
                  className="bg-muted/20 resize-none"
                />
              </Field>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Storefront - what buyers see on Explore */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Storefront</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A published skill is the thing people play. Give it a title, a
                hook and a cover so it earns the click on Explore.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Field>
                <FieldLabel className="text-sm font-bold">Title</FieldLabel>
                <Input
                  placeholder="e.g. Land your first 3 clients"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                  className="bg-muted/20"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  What people see. The slug above stays the runtime name.
                </p>
              </Field>

              <Field>
                <FieldLabel className="text-sm font-bold">Hook</FieldLabel>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    One line, in the buyer&apos;s words: what this lets your
                    persona do for them.
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      form.hook.length >= MAX_HOOK_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {form.hook.length} / {MAX_HOOK_LENGTH}
                  </span>
                </div>
                <Input
                  placeholder="e.g. Turn a rough idea into a pitch you can send today"
                  value={form.hook}
                  onChange={(e) =>
                    update("hook", e.target.value.slice(0, MAX_HOOK_LENGTH))
                  }
                  maxLength={MAX_HOOK_LENGTH}
                  className="bg-muted/20"
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-sm font-bold">
                    Category
                  </FieldLabel>
                  <Select
                    value={form.category}
                    onValueChange={(v) => update("category", v)}
                  >
                    <SelectTrigger className="h-9 w-full bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {skillCategoryLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Sets the Explore shelf and the auto-cover colour.
                  </p>
                </Field>

                <Field>
                  <FieldLabel className="text-sm font-bold">Tags</FieldLabel>
                  <Input
                    placeholder={
                      form.tags.length >= MAX_TAGS
                        ? "Tag limit reached"
                        : "Type a tag and press Enter"
                    }
                    value={tagInput}
                    onChange={(e) =>
                      setTagInput(e.target.value.slice(0, MAX_TAG_LENGTH))
                    }
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => tagInput.trim() && addTag(tagInput)}
                    disabled={form.tags.length >= MAX_TAGS}
                    className="bg-muted/20"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {form.tags.length} / {MAX_TAGS} tags
                  </p>
                </Field>
              </div>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 -mt-3">
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
              )}

              <Field>
                <FieldLabel className="text-sm font-bold">
                  Cover image
                </FieldLabel>
                <div className="flex flex-col sm:flex-row gap-4">
                  <SkillCover
                    skill={coverPreviewSkill}
                    persona={{ avatarUrl: skill?.persona?.avatarUrl }}
                    size="sm"
                    className="size-40 shrink-0 rounded-2xl border border-zinc-150/60 dark:border-zinc-800"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      placeholder="https://…/cover.png"
                      value={form.coverImage}
                      onChange={(e) =>
                        update("coverImage", e.target.value.slice(0, 2000))
                      }
                      className="bg-muted/20 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave empty for an auto-generated cover.
                    </p>
                    {form.coverImage.trim() && (
                      <button
                        type="button"
                        onClick={() => update("coverImage", "")}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Files (SKILL.md + bundled supporting files) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
              <FolderOpen className="size-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Skill Files
              </h2>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              SKILL.md holds the core workflow. Move detailed reference material
              into supporting files (e.g.{" "}
              <code className="bg-muted px-1 rounded">references/guide.md</code>
              , <code className="bg-muted px-1 rounded">scripts/run.py</code>) —
              the agent reads them on demand.
            </p>

            <div className="rounded-xl border bg-muted/20 overflow-hidden flex flex-col sm:flex-row min-h-[440px]">
              {/* File sidebar */}
              <aside className="sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r bg-muted/30 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Files ({form.files.length + 1})
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => {
                      setAddingFile(true);
                      setNewFilePath("");
                    }}
                    title="Add file"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => setActiveFile(null)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-left transition-colors",
                      activeFile == null
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-muted/60",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">SKILL.md</span>
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">
                      main
                    </span>
                  </button>

                  {form.files.map((file, index) => (
                    <div
                      key={index}
                      className={cn(
                        "group flex items-center transition-colors",
                        activeFile === index
                          ? "bg-primary/10"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFile(index)}
                        className={cn(
                          "flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-left",
                          activeFile === index
                            ? "text-primary font-semibold"
                            : "text-foreground/80",
                        )}
                      >
                        <FileIcon
                          path={file.path}
                          className="size-3.5 shrink-0"
                        />
                        <span className="truncate">{file.path}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 mr-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteFile(index)}
                        title="Delete file"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {addingFile && (
                    <div className="px-2 py-1.5">
                      <Input
                        autoFocus
                        placeholder="references/guide.md"
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddFile();
                          if (e.key === "Escape") setAddingFile(false);
                        }}
                        onBlur={() => {
                          if (!newFilePath.trim()) setAddingFile(false);
                        }}
                        className="h-7 text-xs font-mono bg-background"
                      />
                      <div className="flex gap-1 mt-1">
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={handleAddFile}
                        >
                          Add
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setAddingFile(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="px-3 py-2 border-t text-[9px] text-muted-foreground leading-relaxed">
                  Up to {MAX_FILE_COUNT} files, 200KB each, 1MB per skill.
                </p>
              </aside>

              {/* Editor pane */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/60">
                  {activeEntry ? (
                    <>
                      <Input
                        value={activeEntry.path}
                        onChange={(e) =>
                          handleRenameFile(activeFile, e.target.value)
                        }
                        className="h-7 text-xs font-mono max-w-xs bg-muted/20"
                        title="Rename file"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteFile(activeFile)}
                        title="Delete file"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-semibold text-foreground/80">
                      SKILL.md
                    </span>
                  )}
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-medium",
                      !activeEntry && form.instructions.length > 45000
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {activeEntry
                      ? `${activeContent.length.toLocaleString()} chars`
                      : `${form.instructions.length.toLocaleString()} / 50,000 chars`}
                  </span>
                </div>

                <div className="flex-1 overflow-auto focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Editor
                    key={activeFile == null ? "SKILL.md" : `file-${activeFile}`}
                    value={activeContent}
                    onValueChange={(code) =>
                      activeEntry
                        ? updateFile(activeFile, { content: code })
                        : update("instructions", code)
                    }
                    highlight={highlightForPath(activePath)}
                    padding={20}
                    placeholder={
                      activeEntry ? "" : "# Skill Title\n\n## Overview\n..."
                    }
                    style={{
                      fontFamily: '"Fira code", "Fira Mono", monospace',
                      fontSize: 14,
                      minHeight: "400px",
                    }}
                    className="focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Visibility - from agent-form visibility pattern */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Visibility</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control who can discover and use this skill.
              </p>
            </div>

            <div className="lg:col-span-2">
              <div
                role="radiogroup"
                aria-label="Visibility"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                {VISIBILITY_OPTIONS.map((opt) => {
                  const selected = form.visibility === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update("visibility", opt.value)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-zinc-150/60 dark:border-zinc-800 bg-muted/10 hover:border-zinc-300 dark:hover:border-zinc-700",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg",
                          selected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="space-y-0.5">
                        <span className="block text-sm font-bold">
                          {opt.label}
                        </span>
                        <span className="block text-[11px] text-muted-foreground leading-relaxed">
                          {opt.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
