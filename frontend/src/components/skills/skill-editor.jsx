"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Save,
  X,
  Check,
  Globe,
  Plus,
  Trash2,
  FileText,
  FileCode,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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
  description: "",
  instructions: "",
  isPublic: false,
  files: [],
};

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
    description: skill.description || "",
    instructions: skill.instructions || "",
    isPublic: Boolean(skill.isPublic),
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

  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      // Load draft from localStorage if creating new skill
      if (mode === "new") {
        const saved = localStorage.getItem("skill_draft");
        if (saved) {
          try {
            setForm({ ...DEFAULT_FORM, ...JSON.parse(saved) });
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
      .replace(/^-|-$/g, "");
    update("name", formatted);
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
        description: form.description,
        instructions: form.instructions,
        isPublic: form.isPublic,
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
                  Will be saved as:{" "}
                  <code className="bg-muted px-1 rounded">
                    {form.name || "..."}
                  </code>
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
              <Card className="p-4 flex items-center justify-between bg-muted/10 border-dashed">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Globe className="size-3.5 text-primary" />
                    Public Marketplace
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                    Enable this to allow other users to discover and import this
                    skill into their agents.
                  </p>
                </div>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(checked) => update("isPublic", checked)}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
