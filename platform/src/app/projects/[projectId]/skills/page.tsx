"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FileExplorerEditor, type ExplorerItem } from "@/components/file-explorer/file-explorer-editor";
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

// Adapts a Skill to the generic explorer's item shape (id/name/rootContent/
// files) while keeping the original Skill around for skill-specific fields
// (description, isPublic, createdAt) used by the side panel and tab badges.
interface SkillExplorerItem extends ExplorerItem {
  skill: Skill;
}

function skillId(skill: Skill) {
  return skill.id ?? skill._id!;
}

export default function SkillsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [skills, setSkills] = React.useState<Skill[] | null>(null);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [openRequest, setOpenRequest] = React.useState<{ itemId: string; path: string | null } | null>(null);

  const fetchSkills = React.useCallback(async () => {
    const key = cacheKey.resource(projectId, "skills");
    const cached = getCached<Skill[]>(key);
    if (cached) setSkills(cached);
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
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const items = React.useMemo<SkillExplorerItem[] | null>(() => {
    if (!skills) return null;
    return skills.map((s) => ({
      id: skillId(s),
      name: s.name,
      rootContent: s.instructions || "",
      files: s.files ?? [],
      skill: s,
    }));
  }, [skills]);

  const updateSkillState = (id: string, patch: Partial<Skill>) => {
    setSkills((prev) => (prev ?? []).map((s) => (skillId(s) === id ? { ...s, ...patch } : s)));
    deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
  };

  const handleSaveRoot = async (item: SkillExplorerItem, content: string) => {
    const res = await updateProjectSkill(projectId, item.id, { instructions: content });
    updateSkillState(item.id, { ...(res.data?.data as Skill), instructions: content });
  };

  const handleSaveFile = async (item: SkillExplorerItem, path: string, content: string) => {
    const newFiles = (item.skill.files ?? []).map((f) => (f.path === path ? { ...f, content } : f));
    const res = await updateProjectSkill(projectId, item.id, { files: newFiles });
    updateSkillState(item.id, { ...(res.data?.data as Skill), files: newFiles });
  };

  const handleAddFile = async (item: SkillExplorerItem, path: string) => {
    const newFiles = [...(item.skill.files ?? []), { path, content: "" }];
    const res = await updateProjectSkill(projectId, item.id, { files: newFiles });
    updateSkillState(item.id, { ...(res.data?.data as Skill), files: newFiles });
  };

  const handleDeleteFile = async (item: SkillExplorerItem, path: string) => {
    const newFiles = (item.skill.files ?? []).filter((f) => f.path !== path);
    const res = await updateProjectSkill(projectId, item.id, { files: newFiles });
    updateSkillState(item.id, { ...(res.data?.data as Skill), files: newFiles });
  };

  const handleDeleteItem = async (item: SkillExplorerItem) => {
    await deleteProjectSkill(projectId, item.id);
    deleteCachedByPrefix(cacheKey.resource(projectId, "skills"));
    setSkills((prev) => (prev ?? []).filter((s) => skillId(s) !== item.id));
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
      setOpenRequest({ itemId: skillId(created), path: null });
      setShowNewDialog(false);
      setNewSkillName("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden bg-background">
      <FileExplorerEditor<SkillExplorerItem>
        items={items}
        itemLabelPlural="skills"
        rootFileName="SKILL.md"
        onCreateItem={() => setShowNewDialog(true)}
        onSaveRoot={handleSaveRoot}
        onSaveFile={handleSaveFile}
        onDeleteItem={handleDeleteItem}
        onAddFile={handleAddFile}
        onDeleteFile={handleDeleteFile}
        openRequest={openRequest}
        onSettingsClick={() => router.push(`/projects/${projectId}/settings`)}
        searchFilter={(item, q) => item.name.toLowerCase().includes(q) || item.skill.description.toLowerCase().includes(q)}
        emptyStateDescription="Select a skill or file from the Explorer, or create a new skill. Skills bundle reusable instructions (SKILL.md) plus supporting files like references, scripts, and assets."
        emptyStateActionLabel="New Skill"
        renderTabExtras={(item) => (
          <>
            <Badge variant="outline" className="text-[10px]">
              {item.skill.isPublic ? "Public" : "Private"}
            </Badge>
            <span className="hidden text-[11px] text-muted-foreground lg:inline">{item.files.length} files</span>
          </>
        )}
        renderSidePanel={(item) => (
          <>
            <div className="flex h-7 items-center px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Details</div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-3 p-3 text-xs">
                <div>
                  <div className="text-[11px] font-medium">Description</div>
                  <p className="mt-1 line-clamp-3 text-muted-foreground">{item.skill.description || "—"}</p>
                </div>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-mono">{item.skill.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <Badge variant={item.skill.isPublic ? "default" : "outline"} className="h-5 text-[10px]">
                      {item.skill.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Files</span>
                    <span>{(item.skill.files?.length ?? 0) + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-mono text-[11px]">{item.skill.createdAt ? new Date(item.skill.createdAt).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`isPublic-${item.id}`} className="text-xs">
                    Public marketplace
                  </Label>
                  <div className="flex items-center justify-between rounded-none border border-dashed bg-muted/20 px-2 py-1.5">
                    <span className="text-[11px] text-muted-foreground">Visible to other Projects</span>
                    <Switch
                      id={`isPublic-${item.id}`}
                      checked={!!item.skill.isPublic}
                      onCheckedChange={async (checked) => {
                        try {
                          const res = await updateProjectSkill(projectId, item.id, { isPublic: checked });
                          updateSkillState(item.id, { ...(res.data?.data as Skill), isPublic: checked });
                        } catch {}
                      }}
                    />
                  </div>
                </div>
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </>
        )}
      />

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
    </div>
  );
}
