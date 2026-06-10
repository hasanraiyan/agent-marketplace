"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Cpu,
  SearchIcon,
  Globe,
  Lock,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { getMySkills, getPublicSkills, deleteSkill, api } from "@/lib/api/skills";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { SkillDialog } from "@/components/skills/skill-dialog";

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
        const skill = mySkills.find(s => (s._id || s.id) === skillId);
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

  const filteredMySkills = mySkills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPublicSkills = publicSkills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  const SkillCard = ({ skill, isOwner }) => (
    <Card className="group relative flex flex-col overflow-hidden rounded-xl border-none bg-card ring-1 ring-foreground/10 transition-all hover:shadow-lg hover:ring-primary/20 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Cpu className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base truncate max-w-[150px]">
              {skill.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant={skill.isPublic ? "default" : "outline"} className="text-[10px] uppercase px-1.5 py-0">
                {skill.isPublic ? <Globe className="size-2.5 mr-1" /> : <Lock className="size-2.5 mr-1" />}
                {skill.isPublic ? "Public" : "Private"}
              </Badge>
            </div>
          </div>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md p-1 hover:bg-muted transition-colors">
                <MoreVertical className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setEditTarget(skill);
                setIsDialogOpen(true);
              }}>
                <Edit className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
                setDeleteTarget(skill);
                try {
                  const res = await api.get(`/skills/${skill.id || skill._id}/agents`);
                  setUsedByAgents(res.data?.data || []);
                } catch (err) {
                  console.error("Failed to load referencing agents", err);
                }
              }}>
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
        {skill.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t">
        <span className="text-xs text-muted-foreground">
          {skill.updatedAt ? `Updated ${new Date(skill.updatedAt).toLocaleDateString()}` : ""}
        </span>
        {!isOwner && (
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            View <ExternalLink className="ml-1 size-3" />
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-1 flex-col py-4 md:py-6 px-4 lg:px-6">
      <Tabs defaultValue="mine" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="mine">My Skills</TabsTrigger>
          <TabsTrigger value="public">Public Marketplace</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : filteredMySkills.length === 0 ? (
            <Empty className="py-20 border-2 border-dashed rounded-2xl">
              <EmptyHeader>
                <EmptyTitle>No skills found</EmptyTitle>
                <EmptyDescription>
                  {search ? "No skills match your search." : "You haven't created any skills yet."}
                </EmptyDescription>
              </EmptyHeader>
              {!search && (
                <EmptyContent>
                  <Button onClick={() => setIsDialogOpen(true)}
                   className="h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                  >
                    <Plus className="mr-2 size-4" />
                    Create Your First Skill
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMySkills.map((skill) => (
                <SkillCard key={skill._id || skill.id} skill={skill} isOwner={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="public" className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : filteredPublicSkills.length === 0 ? (
            <Empty className="py-20 border-2 border-dashed rounded-2xl">
              <EmptyHeader>
                <EmptyTitle>No public skills</EmptyTitle>
                <EmptyDescription>
                  The marketplace is empty right now.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPublicSkills.map((skill) => (
                <SkillCard key={skill._id || skill.id} skill={skill} isOwner={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                  <p className="text-xs font-bold uppercase mb-2">Used by {usedByAgents.length} agents:</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {usedByAgents.slice(0, 5).map(a => (
                      <li key={a._id || a.id}>{a.name}</li>
                    ))}
                    {usedByAgents.length > 5 && <li>...and {usedByAgents.length - 5} more</li>}
                  </ul>
                  <p className="mt-2 text-[10px]">Deleting this skill will remove it from these agents immediately.</p>
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
