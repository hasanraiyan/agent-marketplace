"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SparkleIcon,
  FolderIcon,
  FolderOpenIcon,
  FileTextIcon,
  FileCodeIcon,
  PlusIcon,
  TrashIcon,
  CaretRightIcon,
  CaretDownIcon,
  FloppyDiskIcon,
  XIcon,
  MagnifyingGlassIcon,
  GlobeIcon,
  PencilSimpleIcon,
  EyeIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/components/ui/code-editor";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  getProjectSkills,
  createProjectSkill,
  updateProjectSkill,
  deleteProjectSkill,
} from "@/lib/api/projects";
import { getCached, setCached, dedupedFetch, cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface SkillFile {
  path: string;
  content: string;
}

interface Skill {
  _id?: string;
  id: string;
  name: string;
  description: string;
  instructions: string;
  isPublic?: boolean;
  files?: SkillFile[];
  createdAt?: string;
  updatedAt?: string;
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt") return <FileTextIcon className={className} />;
  return <FileCodeIcon className={className} />;
}

// Same extension -> fence language mapping used by the chat workspace file
// panel, so a skill's SKILL.md and bundled files get the same Shiki-backed
// preview/highlighting instead of a separate renderer.
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

function fence(content: string, language: string): string {
  return "```" + language + "\n" + content + "\n```";
}

// react-resizable-panels' <Panel> silently drops the className prop, so its
// "hidden sm:flex" visibility can't be CSS-only — this mirrors Tailwind's sm breakpoint in JS.
function useIsSmUp() {
  const [isSmUp, setIsSmUp] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setIsSmUp(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isSmUp;
}

export default function SkillsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [skills, setSkills] = React.useState<Skill[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<string | null>(null); // null = SKILL.md
  const [editorContent, setEditorContent] = React.useState("");
  const [isDirty, setIsDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [showAddFileDialog, setShowAddFileDialog] = React.useState(false);
  const [newFilePath, setNewFilePath] = React.useState("");
  const [mobileExplorerOpen, setMobileExplorerOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"edit" | "preview">("edit");
  const isSmUp = useIsSmUp();

  const selectedSkill = skills?.find((s) => (s.id ?? s._id) === selectedSkillId) || null;
  const activePath = activeFile ?? "SKILL.md";
  const isSkillMd = activeFile === null;
  const isMarkdownFile = isSkillMd || /\.(md|markdown)$/i.test(activePath);
  const fenceLanguage = EXTENSION_LANGUAGE_MAP[activePath.split(".").pop()?.toLowerCase() ?? ""] ?? activePath.split(".").pop()?.toLowerCase() ?? "text";

  const fetchSkills = React.useCallback(async () => {
    const key = cacheKey.resource(projectId, "skills");
    const cached = getCached<Skill[]>(key);
    if (cached) {
      setSkills(cached);
      setLoading(false);
    }
    try {
      const data = await dedupedFetch<Skill[]>(key, () =>
        getProjectSkills(projectId).then((r) => {
          const raw = r.data?.data;
          return (Array.isArray(raw) ? raw : (raw?.items ?? raw ?? [])) as Skill[];
        })
      );
      setCached(key, data);
      setSkills(data);
    } catch {
      if (!cached) setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  React.useEffect(() => {
    if (skills && skills.length > 0 && !selectedSkillId) {
      const first = skills[0];
      const id = first.id ?? first._id!;
      setSelectedSkillId(id);
      setExpanded((prev) => new Set(prev).add(id));
      setActiveFile(null);
      setEditorContent(first.instructions || "");
      setIsDirty(false);
    }
  }, [skills, selectedSkillId]);

  React.useEffect(() => {
    if (!selectedSkill) return;
    if (isSkillMd) setEditorContent(selectedSkill.instructions || "");
    else {
      const f = selectedSkill.files?.find((fi) => fi.path === activeFile);
      setEditorContent(f?.content || "");
    }
    setIsDirty(false);
  }, [selectedSkillId, activeFile, selectedSkill, isSkillMd]);

  const filtered = React.useMemo(() => {
    if (!skills) return [];
    const q = search.toLowerCase().trim();
    if (!q) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [skills, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectSkill = (skill: Skill) => {
    const id = skill.id ?? skill._id!;
    setSelectedSkillId(id);
    setExpanded((prev) => new Set(prev).add(id));
    setActiveFile(null);
    setMobileExplorerOpen(false);
  };

  const handleSelectFile = (skill: Skill, path: string | null) => {
    const id = skill.id ?? skill._id!;
    setSelectedSkillId(id);
    setExpanded((prev) => new Set(prev).add(id));
    setActiveFile(path);
    setMobileExplorerOpen(false);
  };

  const handleEditorChange = (value: string) => {
    setEditorContent(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = isSkillMd
        ? { instructions: editorContent }
        : { files: selectedSkill.files?.map((f) => (f.path === activeFile ? { ...f, content: editorContent } : f)) };
      const id = selectedSkill.id ?? selectedSkill._id!;
      const res = await updateProjectSkill(projectId, id, payload);
      const updated = res.data?.data as Skill;
      setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === id ? { ...s, ...payload, ...updated } : s)));
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      setIsDirty(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSkillName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!name || name.length < 2) return;
    try {
      const description = `Describe what ${name} does. Use when asked to …`;
      const res = await createProjectSkill(projectId, {
        name,
        description,
        instructions: `---\nname: ${name}\ndescription: ${description}\n---\n\nDescribe step by step how the Agent should perform this skill.\n`,
        isPublic: false,
        files: [],
      });
      const created = res.data?.data as Skill;
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      setSkills((prev) => [created, ...(prev ?? [])]);
      setSelectedSkillId(created.id ?? created._id!);
      setExpanded((prev) => new Set(prev).add(created.id ?? created._id!));
      setShowNewDialog(false);
      setNewSkillName("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSkill = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    const id = skill.id ?? skill._id!;
    try {
      await deleteProjectSkill(projectId, id);
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      setSkills((prev) => (prev ?? []).filter((s) => (s.id ?? s._id) !== id));
      if (selectedSkillId === id) {
        setSelectedSkillId(skills?.[0] ? (skills[0].id ?? skills[0]._id!) : null);
        setActiveFile(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkill) return;
    const trimmed = newFilePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!trimmed || trimmed.toUpperCase() === "SKILL.MD") return;
    const id = selectedSkill.id ?? selectedSkill._id!;
    const newFiles = [...(selectedSkill.files ?? []), { path: trimmed, content: "" }];
    setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === id ? { ...s, files: newFiles } : s)));
    setActiveFile(trimmed);
    setIsDirty(true);
    setShowAddFileDialog(false);
    setNewFilePath("");
  };

  const renderSkillTree = () =>
    filtered.length === 0 ? (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No skills found.</div>
    ) : (
      filtered.map((skill) => {
        const id = skill.id ?? skill._id!;
        const isSelected = selectedSkillId === id;
        const isExpanded = expanded.has(id);
        return (
          <div key={id} className="flex flex-col">
            <div className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleExpand(id)}
                className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => handleSelectSkill(skill)}
                className="flex flex-1 items-center gap-1.5 truncate rounded-none px-1 py-1 text-left text-xs hover:bg-muted/60"
              >
                {isExpanded ? <FolderOpenIcon className="size-3.5 shrink-0" /> : <FolderIcon className="size-3.5 shrink-0" />}
                <span className="truncate font-medium">{skill.name}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteSkill(skill)}
              >
                <TrashIcon className="size-3" />
              </Button>
            </div>
            {isExpanded && (
              <div className="ml-4 flex flex-col border-l pl-2">
                <button
                  type="button"
                  onClick={() => handleSelectFile(skill, null)}
                  className={`flex items-center gap-1.5 truncate rounded-none px-2 py-1 text-left text-xs ${isSelected && activeFile === null ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                >
                  <FileTextIcon className="size-3.5 shrink-0" />
                  <span className="truncate">SKILL.md</span>
                </button>
                {(skill.files ?? []).map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => handleSelectFile(skill, f.path)}
                    className={`flex items-center gap-1.5 truncate rounded-none px-2 py-1 text-left text-xs ${isSelected && activeFile === f.path ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                  >
                    <FileIcon path={f.path} className="size-3.5 shrink-0" />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectSkill(skill);
                    setShowAddFileDialog(true);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  <PlusIcon className="size-3" />
                  <span>Add file</span>
                </button>
              </div>
            )}
          </div>
        );
      })
    );

  if (loading) {
    return (
      <div className="flex h-full w-full">
        <div className="hidden w-[260px] shrink-0 border-r bg-muted/20 p-3 sm:flex sm:flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="flex flex-1 flex-col p-6 gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/20 px-2 sm:px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-xs" className="sm:hidden" onClick={() => setMobileExplorerOpen((v) => !v)}>
            <FolderIcon />
          </Button>
          {isDirty && <span className="hidden text-[10px] font-medium text-amber-500 sm:inline">• Unsaved</span>}
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="relative flex-1">
        {/* Activity Bar - VS Code style far left */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r bg-muted/10 py-2 sm:flex">
          <Button variant="ghost" size="icon-sm" className="bg-primary/10 text-primary" aria-label="Explorer">
            <FolderOpenIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Search" onClick={() => document.getElementById("skill-search")?.focus()}>
            <MagnifyingGlassIcon />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Settings" onClick={() => router.push(`/projects/${projectId}/settings`)}>
            <GlobeIcon />
          </Button>
        </div>

        {/* Explorer Sidebar - conditionally rendered (not CSS-hidden) because
            react-resizable-panels' <Panel> silently drops className, so
            "hidden sm:flex" can't hide it on mobile */}
        {isSmUp && (
        <ResizablePanel defaultSize="22" minSize="18" maxSize="32">
          <div className="flex h-full w-full min-w-[220px] flex-col border-r bg-muted/5">
            <div className="flex h-7 shrink-0 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Explorer
              <Button variant="ghost" size="icon-xs" className="size-5" onClick={() => setShowNewDialog(true)}>
                <PlusIcon className="size-3" />
              </Button>
            </div>
            <div className="px-2 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="skill-search" placeholder="Search skills…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-0.5 px-1 pb-4">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">PROJECT SKILLS</div>
                {renderSkillTree()}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{skills?.length ?? 0} skills</span>
                <span className="hidden sm:inline">Explorer</span>
              </div>
            </div>
          </div>
        </ResizablePanel>
        )}

        {/* Mobile explorer drawer - same folder/file tree as the desktop Explorer */}
        {mobileExplorerOpen && (
          <div className="absolute inset-0 z-20 flex sm:hidden">
            <div className="flex w-[280px] flex-col border-r bg-background">
              <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Explorer</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => setShowNewDialog(true)}>
                    <PlusIcon className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => setMobileExplorerOpen(false)}>
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="px-2 pb-2 pt-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search skills…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-0.5 px-1 pb-4">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">PROJECT SKILLS</div>
                  {renderSkillTree()}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
              <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">{skills?.length ?? 0} skills</div>
            </div>
            <button type="button" className="flex-1 bg-black/20" onClick={() => setMobileExplorerOpen(false)} />
          </div>
        )}

        {isSmUp && <ResizableHandle withHandle />}

        {/* Editor Area */}
        <ResizablePanel defaultSize="78">
        <div className="flex h-full w-full min-w-0 flex-col bg-background">
          {!selectedSkill ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-none bg-muted">
                  <SparkleIcon className="size-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium">No skill selected</h3>
                <p className="text-xs text-muted-foreground">Select a skill from the Explorer or create a new one. Skills bundle reusable instructions (SKILL.md) plus supporting files like references, scripts, and assets.</p>
                <Button size="sm" onClick={() => setShowNewDialog(true)}>
                  <PlusIcon data-icon="inline-start" />
                  New Skill
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs bar - VS Code style */}
              <div className="flex h-9 shrink-0 items-center gap-0 overflow-x-auto border-b bg-muted/20">
                <div
                  role="tab"
                  aria-selected={isSkillMd}
                  onClick={() => setActiveFile(null)}
                  className={`flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs ${isSkillMd ? "bg-background text-foreground" : "bg-muted/10 text-muted-foreground hover:bg-muted/30"}`}
                >
                  <FileTextIcon className="size-3.5" />
                  <span className="max-w-[140px] truncate">SKILL.md</span>
                  {isDirty && isSkillMd && <span className="size-1.5 rounded-full bg-primary" />}
                </div>
                {!isSkillMd && activeFile && (
                  <div
                    role="tab"
                    aria-selected
                    className="flex h-full shrink-0 items-center gap-1.5 border-r bg-background px-3 text-xs text-foreground"
                  >
                    <FileIcon path={activeFile} className="size-3.5" />
                    <span className="max-w-[160px] truncate">{activeFile}</span>
                    {isDirty && <span className="size-1.5 rounded-full bg-primary" />}
                    <button type="button" onClick={() => setActiveFile(null)} className="ml-1 rounded-sm p-0.5 hover:bg-muted">
                      <XIcon className="size-3" />
                    </button>
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex shrink-0 items-center gap-0.5 border-l px-1.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`flex items-center gap-1 rounded-none px-2 py-1 text-[11px] ${viewMode === "edit" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                  >
                    <PencilSimpleIcon className="size-3" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1 rounded-none px-2 py-1 text-[11px] ${viewMode === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                  >
                    <EyeIcon className="size-3" />
                    <span className="hidden sm:inline">Preview</span>
                  </button>
                </div>
                <div className="hidden items-center gap-1 pr-2 sm:flex">
                  <Badge variant="outline" className="text-[10px]">
                    {selectedSkill.isPublic ? "Public" : "Private"}
                  </Badge>
                  <span className="hidden text-[11px] text-muted-foreground lg:inline">
                    {selectedSkill.files ? `${selectedSkill.files.length} files` : "0 files"}
                  </span>
                </div>
              </div>

              {/* Breadcrumb */}
              <div className="flex h-6 shrink-0 items-center gap-1 border-b bg-muted/10 px-3 text-[11px] text-muted-foreground">
                <span className="truncate">{selectedSkill.name}</span>
                <span>›</span>
                <span className="truncate font-mono">{activePath}</span>
              </div>

              {/* Editor */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  {viewMode === "preview" ? (
                    <div className="h-full min-h-0 w-full flex-1 overflow-y-auto p-4">
                      <MessageMarkdown content={isMarkdownFile ? editorContent : fence(editorContent, fenceLanguage)} />
                    </div>
                  ) : (
                    <CodeEditor
                      value={editorContent}
                      onChange={handleEditorChange}
                      language={isMarkdownFile ? "markdown" : fenceLanguage}
                      placeholder={isSkillMd ? "# Skill Title\n\n## Overview\n\nWrite the full instructions an Agent should follow…" : ""}
                      className="h-full min-h-0 w-full flex-1"
                      spellCheck={false}
                    />
                  )}

                  {/* Right preview - hidden on small, visible on xl */}
                  <div className="hidden w-[320px] shrink-0 border-l bg-muted/5 xl:flex xl:flex-col">
                    <div className="flex h-7 items-center px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Details</div>
                    <ScrollArea className="flex-1">
                      <div className="flex flex-col gap-3 p-3 text-xs">
                        <div>
                          <div className="text-[11px] font-medium">Description</div>
                          <p className="mt-1 line-clamp-3 text-muted-foreground">{selectedSkill.description || "—"}</p>
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-mono">{selectedSkill.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Visibility</span>
                            <Badge variant={selectedSkill.isPublic ? "default" : "outline"} className="h-5 text-[10px]">
                              {selectedSkill.isPublic ? "Public" : "Private"}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Files</span>
                            <span>{(selectedSkill.files?.length ?? 0) + 1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span className="font-mono text-[11px]">{selectedSkill.createdAt ? new Date(selectedSkill.createdAt).toLocaleDateString() : "—"}</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="isPublic" className="text-xs">
                            Public marketplace
                          </Label>
                          <div className="flex items-center justify-between rounded-none border border-dashed bg-muted/20 px-2 py-1.5">
                            <span className="text-[11px] text-muted-foreground">Visible to other Projects</span>
                            <Switch
                              id="isPublic"
                              checked={!!selectedSkill.isPublic}
                              onCheckedChange={async (checked) => {
                                const id = selectedSkill.id ?? selectedSkill._id!;
                                try {
                                  const res = await updateProjectSkill(projectId, id, { isPublic: checked });
                                  const updated = res.data?.data as Skill;
                                  setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === id ? { ...s, isPublic: checked, ...updated } : s)));
                                  deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
                                } catch {}
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </div>
                </div>

                {/* Status bar - VS Code style */}
                <div className="flex h-6 shrink-0 items-center justify-between border-t bg-primary px-2 text-[11px] text-primary-foreground">
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline">{isDirty ? "● Unsaved" : "✓ Saved"}</span>
                    <span className="hidden sm:inline">{activePath.endsWith(".md") ? "Markdown" : activePath.split(".").pop()?.toUpperCase() || "Plain Text"}</span>
                    <span>{editorContent.length} chars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Spaces: 2</span>
                    <span className="hidden sm:inline">UTF-8</span>
                    <Button
                      size="xs"
                      variant="secondary"
                      className="h-5 bg-white text-primary hover:bg-white/90 text-[11px]"
                      onClick={handleSave}
                      disabled={!isDirty || saving}
                    >
                      <FloppyDiskIcon data-icon="inline-start" className="size-3" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Skill</DialogTitle>
            <DialogDescription>Creates a folder with a starter SKILL.md. Name is lowercase with hyphens — you can edit everything after.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-4 py-2"
          >
            <Field>
              <FieldLabel htmlFor="new-name">Name</FieldLabel>
              <Input
                id="new-name"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="e.g. data-analysis"
                required
                autoFocus
                maxLength={64}
                className="font-mono text-sm"
              />
              <FieldDescription>2–64, lowercase, a-z 0-9 and hyphens only. Will be saved as /{newSkillName || "..."}/SKILL.md</FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Skill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFileDialog} onOpenChange={setShowAddFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add file</DialogTitle>
            <DialogDescription>Bundle a supporting file alongside SKILL.md, e.g. references/guide.md.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreateFile}
            className="flex flex-col gap-4 py-2"
          >
            <Field>
              <FieldLabel htmlFor="new-file-path">File path</FieldLabel>
              <Input
                id="new-file-path"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="e.g. references/guide.md"
                required
                autoFocus
                maxLength={256}
                className="font-mono text-sm"
              />
              <FieldDescription>Relative path within the skill folder. Cannot be SKILL.md.</FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddFileDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Add file</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
