"use client";

import { useState, useEffect } from "react";
import { Plus, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import {
  getMySkills,
  getPublicSkills,
  deleteSkill,
  getUsedByAgents,
} from "@/lib/api/skills";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { SkillDialog } from "@/components/skills/skill-dialog";
import { SkillList } from "./components/SkillList";

export default function SkillsPage() {
  const [mySkills, setMySkills] = useState([]);
  const [publicSkills, setPublicSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [usedByAgents, setUsedByAgents] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const skillId = urlParams.get("id");
      if (skillId && mySkills.length > 0) {
        const skill = mySkills.find((s) => (s._id || s.id) === skillId);
        if (skill) {
          setEditTarget(skill);
          setIsDialogOpen(true);
        }
      }
    }
  }, [mySkills]);

  useDashboardHeader(
    {
      title: "My Skills",
      description: "Manage specialized capabilities for your agents.",
      actions: (
        <div className="flex items-center gap-2">
          <div className="hidden w-72 md:block">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <SearchIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-base"
              />
            </InputGroup>
          </div>
          <Button
            size="sm"
            className="h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              setEditTarget(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Create Skill
          </Button>
        </div>
      ),
    },
    [search],
  );

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const [myRes, publicRes] = await Promise.all([
        getMySkills(),
        getPublicSkills(),
      ]);
      setMySkills(myRes.data?.data || []);
      setPublicSkills(publicRes.data?.data || []);
    } catch (err) {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSkill(deleteTarget.id || deleteTarget._id);
      toast.success("Skill deleted");
      setDeleteTarget(null);
      fetchSkills();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete skill");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (skill) => {
    setEditTarget(skill);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = async (skill) => {
    setDeleteTarget(skill);
    try {
      const res = await getUsedByAgents(skill.id || skill._id);
      setUsedByAgents(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load referencing agents", err);
    }
  };

  return (
    <div className="flex flex-1 flex-col py-4 md:py-6 px-4 lg:px-6">
      <SkillList
        mySkills={mySkills}
        publicSkills={publicSkills}
        loading={loading}
        search={search}
        onEdit={handleEdit}
        onDelete={openDeleteDialog}
        onCreateFirst={() => setIsDialogOpen(true)}
      />

      <SkillDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        skill={editTarget}
        onSuccess={fetchSkills}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget?.name}
                </span>
                .
              </p>
              {usedByAgents.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                  <p className="text-xs font-bold uppercase mb-2">
                    Used by {usedByAgents.length} agents:
                  </p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {usedByAgents.slice(0, 5).map((a) => (
                      <li key={a._id || a.id}>{a.name}</li>
                    ))}
                    {usedByAgents.length > 5 && (
                      <li>...and {usedByAgents.length - 5} more</li>
                    )}
                  </ul>
                  <p className="mt-2 text-[10px]">
                    Deleting this skill will remove it from these agents
                    immediately.
                  </p>
                </div>
              )}
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
