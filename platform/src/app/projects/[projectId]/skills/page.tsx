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
  DotsThreeVerticalIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/components/ui/code-editor";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// An open editor tab. Content lives here, independent of any other tab, so
// switching between skills/files never touches an unsaved buffer — same
// model as VS Code: a file only leaves memory when its tab is closed
// (prompting first if dirty) or explicitly saved.
interface OpenTab {
  key: string; // `${skillId}::${path ?? ""}`
  skillId: string;
  path: string | null; // null = SKILL.md
  content: string;
  isDirty: boolean;
}

function tabKey(skillId: string, path: string | null) {
  return `${skillId}::${path ?? ""}`;
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt") return <FileTextIcon className={className} />;
  return <FileCodeIcon className={className} />;
}

interface FileTreeNode {
  name: string;
  path: string;
  file?: SkillFile;
  children?: FileTreeNode[];
}

// Bundled files carry a slash-separated relative path (e.g. "app/sexy.md")
// but the API returns them as a flat list — this groups them into a real
// nested folder tree, VS Code style, instead of showing the raw path string
// as one flat leaf item.
function buildFileTree(files: SkillFile[]): FileTreeNode[] {
  interface MutableNode {
    name: string;
    path: string;
    file?: SkillFile;
    children: Map<string, MutableNode>;
  }
  const root = new Map<string, MutableNode>();

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let level = root;
    let currentPath = "";
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path: currentPath, children: new Map() };
        level.set(part, node);
      }
      if (i === parts.length - 1) node.file = f;
      level = node.children;
    });
  }

  function finalize(map: Map<string, MutableNode>): FileTreeNode[] {
    return Array.from(map.values())
      .sort((a, b) => {
        const aFolder = !a.file;
        const bFolder = !b.file;
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({
        name: n.name,
        path: n.path,
        file: n.file,
        children: n.children.size ? finalize(n.children) : undefined,
      }));
  }

  return finalize(root);
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
  const [openTabs, setOpenTabs] = React.useState<OpenTab[]>([]);
  const [activeTabKey, setActiveTabKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [showAddFileDialog, setShowAddFileDialog] = React.useState(false);
  const [newFilePath, setNewFilePath] = React.useState("");
  const [addFileSkillId, setAddFileSkillId] = React.useState<string | null>(null);
  const [mobileExplorerOpen, setMobileExplorerOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"edit" | "preview">("edit");
  const isSmUp = useIsSmUp();
  const didAutoOpenRef = React.useRef(false);

  const activeTab = openTabs.find((t) => t.key === activeTabKey) ?? null;
  const activeSkill = activeTab ? (skills?.find((s) => (s.id ?? s._id) === activeTab.skillId) ?? null) : null;
  const isSkillMd = activeTab ? activeTab.path === null : false;
  const activePath = activeTab ? (activeTab.path ?? "SKILL.md") : "";
  const isMarkdownFile = isSkillMd || /\.(md|markdown)$/i.test(activePath);
  const fenceLanguage = EXTENSION_LANGUAGE_MAP[activePath.split(".").pop()?.toLowerCase() ?? ""] ?? activePath.split(".").pop()?.toLowerCase() ?? "text";
  const editorContent = activeTab?.content ?? "";
  const isDirty = activeTab?.isDirty ?? false;
  const openSkillIds = new Set(openTabs.map((t) => t.skillId));
  const showSkillLabelInTabs = openSkillIds.size > 1;

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

  // Auto-open the first skill's SKILL.md once, the first time skills load —
  // doesn't fight the user if they later close every tab.
  React.useEffect(() => {
    if (!didAutoOpenRef.current && skills && skills.length > 0) {
      didAutoOpenRef.current = true;
      const first = skills[0];
      const id = first.id ?? first._id!;
      setExpanded((prev) => new Set(prev).add(id));
      const key = tabKey(id, null);
      setOpenTabs((prev) => (prev.length === 0 ? [{ key, skillId: id, path: null, content: first.instructions || "", isDirty: false }] : prev));
      setActiveTabKey((prev) => prev ?? key);
    }
  }, [skills]);

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

  // Opens a file/SKILL.md in its own tab (reusing one already open for the
  // same skill+path instead of duplicating it) and focuses it.
  const openFile = (skill: Skill, path: string | null) => {
    const skillId = skill.id ?? skill._id!;
    const key = tabKey(skillId, path);
    setExpanded((prev) => new Set(prev).add(skillId));
    setMobileExplorerOpen(false);
    setOpenTabs((prev) => {
      if (prev.some((t) => t.key === key)) return prev;
      const content = path === null ? (skill.instructions || "") : (skill.files?.find((f) => f.path === path)?.content ?? "");
      return [...prev, { key, skillId, path, content, isDirty: false }];
    });
    setActiveTabKey(key);
  };

  const closeTab = (key: string) => {
    const tab = openTabs.find((t) => t.key === key);
    if (tab?.isDirty && !confirm(`Discard unsaved changes to ${tab.path ?? "SKILL.md"}?`)) return;
    const idx = openTabs.findIndex((t) => t.key === key);
    const next = openTabs.filter((t) => t.key !== key);
    setOpenTabs(next);
    if (activeTabKey === key) {
      const fallback = next[idx] ?? next[idx - 1] ?? null;
      setActiveTabKey(fallback ? fallback.key : null);
    }
  };

  const handleEditorChange = (value: string) => {
    if (!activeTabKey) return;
    setOpenTabs((prev) => prev.map((t) => (t.key === activeTabKey ? { ...t, content: value, isDirty: true } : t)));
  };

  const handleSave = async () => {
    if (!activeTab || !activeSkill) return;
    setSaving(true);
    try {
      const isMd = activeTab.path === null;
      const payload: Record<string, unknown> = isMd
        ? { instructions: activeTab.content }
        : { files: activeSkill.files?.map((f) => (f.path === activeTab.path ? { ...f, content: activeTab.content } : f)) };
      const skillId = activeTab.skillId;
      const res = await updateProjectSkill(projectId, skillId, payload);
      const updated = res.data?.data as Skill;
      setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === skillId ? { ...s, ...payload, ...updated } : s)));
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      const savedKey = activeTab.key;
      setOpenTabs((prev) => prev.map((t) => (t.key === savedKey ? { ...t, isDirty: false } : t)));
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
      openFile(created, null);
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
      const remaining = openTabs.filter((t) => t.skillId !== id);
      setOpenTabs(remaining);
      if (activeTab?.skillId === id) {
        setActiveTabKey(remaining[0]?.key ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    const skill = skills?.find((s) => (s.id ?? s._id) === addFileSkillId);
    if (!skill) return;
    const trimmed = newFilePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!trimmed || trimmed.toUpperCase() === "SKILL.MD") return;
    const id = skill.id ?? skill._id!;
    const newFiles = [...(skill.files ?? []), { path: trimmed, content: "" }];
    setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === id ? { ...s, files: newFiles } : s)));
    openFile({ ...skill, files: newFiles }, trimmed);
    setShowAddFileDialog(false);
    setNewFilePath("");
    setAddFileSkillId(null);
  };

  // No dedicated per-file DELETE route exists on the backend — but PATCH
  // /skills/:id does a true $set replace of the whole `files` array
  // server-side (confirmed against skill.repository.js), so resending the
  // array without this entry is a correct, atomic delete, same mechanism
  // "Add file" already uses.
  const handleDeleteFile = async (skill: Skill, path: string) => {
    if (!confirm(`Delete file "${path}"?`)) return;
    const id = skill.id ?? skill._id!;
    const newFiles = (skill.files ?? []).filter((f) => f.path !== path);
    try {
      const res = await updateProjectSkill(projectId, id, { files: newFiles });
      const updated = res.data?.data as Skill;
      setSkills((prev) => (prev ?? []).map((s) => ((s.id ?? s._id) === id ? { ...s, files: newFiles, ...updated } : s)));
      deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
      const key = tabKey(id, path);
      const remaining = openTabs.filter((t) => t.key !== key);
      setOpenTabs(remaining);
      if (activeTabKey === key) {
        setActiveTabKey(remaining[0]?.key ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderFileNodes = (nodes: FileTreeNode[], skill: Skill, skillId: string, depth: number): React.ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: `${8 + depth * 12}px` };
      if (!node.file) {
        return (
          <div key={node.path} className="flex flex-col">
            <div style={indent} className="flex items-center gap-1.5 truncate py-1 pr-2 text-xs text-muted-foreground">
              <FolderIcon className="size-3.5 shrink-0" />
              <span className="truncate">{node.name}</span>
            </div>
            {node.children && renderFileNodes(node.children, skill, skillId, depth + 1)}
          </div>
        );
      }
      const isActive = activeTabKey === tabKey(skillId, node.path);
      return (
        <div key={node.path} className="group flex items-center gap-0.5">
          <button
            type="button"
            style={indent}
            onClick={() => openFile(skill, node.path!)}
            className={`flex flex-1 items-center gap-1.5 truncate rounded-none py-1 pr-1 text-left text-xs ${isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
          >
            <FileIcon path={node.path} className="size-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-none text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 data-popup-open:opacity-100"
                >
                  <DotsThreeVerticalIcon className="size-3.5" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => handleDeleteFile(skill, node.file!.path)}>
                <TrashIcon className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    });

  const renderSkillTree = () =>
    filtered.length === 0 ? (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No skills found.</div>
    ) : (
      filtered.map((skill) => {
        const id = skill.id ?? skill._id!;
        const isExpanded = expanded.has(id);
        const isSkillMdActive = activeTabKey === tabKey(id, null);
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
                onClick={() => openFile(skill, null)}
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
                  onClick={() => openFile(skill, null)}
                  className={`flex items-center gap-1.5 truncate rounded-none px-2 py-1 text-left text-xs ${isSkillMdActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                >
                  <FileTextIcon className="size-3.5 shrink-0" />
                  <span className="truncate">SKILL.md</span>
                </button>
                {renderFileNodes(buildFileTree(skill.files ?? []), skill, id, 0)}
                <button
                  type="button"
                  onClick={() => {
                    setAddFileSkillId(id);
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
          {/* Mobile-only Explorer toggle - desktop has the persistent Activity Bar instead */}
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2 sm:hidden">
            <Button variant="ghost" size="icon-xs" onClick={() => setMobileExplorerOpen((v) => !v)}>
              <FolderIcon />
            </Button>
          </div>
          {!activeTab || !activeSkill ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-none bg-muted">
                  <SparkleIcon className="size-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium">No file open</h3>
                <p className="text-xs text-muted-foreground">Select a skill or file from the Explorer, or create a new skill. Skills bundle reusable instructions (SKILL.md) plus supporting files like references, scripts, and assets.</p>
                <Button size="sm" onClick={() => setShowNewDialog(true)}>
                  <PlusIcon data-icon="inline-start" />
                  New Skill
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs bar - VS Code style, one tab per open file across any skill */}
              <div className="flex h-9 shrink-0 items-center gap-0 overflow-x-auto border-b bg-muted/20">
                {openTabs.map((tab) => {
                  const tabSkill = skills?.find((s) => (s.id ?? s._id) === tab.skillId);
                  const label = tab.path ?? "SKILL.md";
                  const isActive = tab.key === activeTabKey;
                  return (
                    <div
                      key={tab.key}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTabKey(tab.key)}
                      className={`flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs ${isActive ? "bg-background text-foreground" : "bg-muted/10 text-muted-foreground hover:bg-muted/30"}`}
                    >
                      {tab.path === null ? <FileTextIcon className="size-3.5 shrink-0" /> : <FileIcon path={tab.path} className="size-3.5 shrink-0" />}
                      <span className="flex min-w-0 flex-col leading-tight">
                        {showSkillLabelInTabs && <span className="max-w-[140px] truncate text-[9px] text-muted-foreground/70">{tabSkill?.name}</span>}
                        <span className="max-w-[140px] truncate">{label}</span>
                      </span>
                      {tab.isDirty && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.key);
                        }}
                        className="ml-1 shrink-0 rounded-sm p-0.5 hover:bg-muted"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex-1" />
                {isMarkdownFile && (
                  <button
                    type="button"
                    onClick={() => setViewMode((m) => (m === "preview" ? "edit" : "preview"))}
                    className="flex shrink-0 items-center gap-1 border-l px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    {viewMode === "preview" ? <PencilSimpleIcon className="size-3" /> : <EyeIcon className="size-3" />}
                    <span className="hidden sm:inline">{viewMode === "preview" ? "Edit" : "Preview"}</span>
                  </button>
                )}
                <div className="hidden items-center gap-1 pr-2 sm:flex">
                  <Badge variant="outline" className="text-[10px]">
                    {activeSkill.isPublic ? "Public" : "Private"}
                  </Badge>
                  <span className="hidden text-[11px] text-muted-foreground lg:inline">
                    {activeSkill.files ? `${activeSkill.files.length} files` : "0 files"}
                  </span>
                </div>
              </div>

              {/* Breadcrumb */}
              <div className="flex h-6 shrink-0 items-center gap-1 border-b bg-muted/10 px-3 text-[11px] text-muted-foreground">
                <span className="truncate">{activeSkill.name}</span>
                <span>›</span>
                <span className="truncate font-mono">{activePath}</span>
              </div>

              {/* Editor */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  {viewMode === "preview" && isMarkdownFile ? (
                    <div className="h-full min-h-0 w-full flex-1 overflow-y-auto p-4">
                      <MessageMarkdown content={editorContent} />
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
                          <p className="mt-1 line-clamp-3 text-muted-foreground">{activeSkill.description || "—"}</p>
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-mono">{activeSkill.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Visibility</span>
                            <Badge variant={activeSkill.isPublic ? "default" : "outline"} className="h-5 text-[10px]">
                              {activeSkill.isPublic ? "Public" : "Private"}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Files</span>
                            <span>{(activeSkill.files?.length ?? 0) + 1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span className="font-mono text-[11px]">{activeSkill.createdAt ? new Date(activeSkill.createdAt).toLocaleDateString() : "—"}</span>
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
                              checked={!!activeSkill.isPublic}
                              onCheckedChange={async (checked) => {
                                const id = activeSkill.id ?? activeSkill._id!;
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

      <Dialog
        open={showAddFileDialog}
        onOpenChange={(open) => {
          setShowAddFileDialog(open);
          if (!open) setAddFileSkillId(null);
        }}
      >
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddFileDialog(false);
                  setAddFileSkillId(null);
                }}
              >
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
