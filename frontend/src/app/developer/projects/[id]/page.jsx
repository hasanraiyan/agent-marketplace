"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Loader2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Trash2,
  Undo2,
  UserPlus,
  KeyRound,
  Copy,
  Plus,
} from "lucide-react";
import {
  getProject,
  updateProject,
  suspendProject,
  reactivateProject,
  requestProjectDeletion,
  cancelProjectDeletion,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  getProjectCredentials,
  mintProjectCredential,
  revokeProjectCredential,
  getProjectAgents,
  getProjectSkills,
  getProjectKnowledge,
  getProjectMcps,
  getProjectProviders,
  deleteProjectProvider,
  deleteProjectSkill,
} from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Badge has no real "success" variant (only default/secondary/destructive/
// outline/ghost/link) — same workaround as projects/page.jsx and
// studio/(resources)/providers/page.jsx.
const STATUS_BADGE_CLASSNAME = {
  ACTIVE:
    "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};
const STATUS_BADGE_VARIANT = {
  ACTIVE: "outline",
  SUSPENDED: "secondary",
  DELETING: "destructive",
  DELETED: "outline",
};

const CREDENTIAL_BADGE_CLASSNAME = {
  ACTIVE:
    "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};
const CREDENTIAL_BADGE_VARIANT = {
  ACTIVE: "outline",
  REVOKED: "secondary",
};

// Agents/Skills/Knowledge/Connectors all share a name+description+createdAt
// shape for read-only browsing — one small table renderer instead of
// repeating the same JSX four times.
function NameDescriptionTable({
  items,
  loading,
  emptyLabel,
  getEditHref,
  onDelete,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const showActions = !!(getEditHref || onDelete);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const id = item._id || item.id;
          return (
            <TableRow key={id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="max-w-md truncate text-muted-foreground">
                {item.description || "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString()
                  : "—"}
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {getEditHref && (
                      <Link href={getEditHref(id)}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(item)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function ProjectDetailPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const { isLoaded, isSignedIn } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [cancelDeletionOpen, setCancelDeletionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);

  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [mintOpen, setMintOpen] = useState(false);
  const [mintLabel, setMintLabel] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintedSecret, setMintedSecret] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [deleteSkillTarget, setDeleteSkillTarget] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [mcps, setMcps] = useState([]);
  const [mcpsLoading, setMcpsLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [deleteProviderTarget, setDeleteProviderTarget] = useState(null);
  const [deletingProvider, setDeletingProvider] = useState(false);

  useDashboardHeader(
    {
      title: project?.name || "Project",
      description: "Manage this Project's metadata and lifecycle.",
    },
    [project?.name],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getProject(projectId);
        if (res.data?.success) {
          setProject(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Project.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setMembersLoading(true);
        const res = await getProjectMembers(projectId);
        if (res.data?.success) {
          setMembers(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Members.");
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setCredentialsLoading(true);
        const res = await getProjectCredentials(projectId);
        if (res.data?.success) {
          setCredentials(res.data.data);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load Credentials.",
        );
      } finally {
        setCredentialsLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setAgentsLoading(true);
        const res = await getProjectAgents(projectId);
        if (res.data?.success) {
          setAgents(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Agents.");
      } finally {
        setAgentsLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setSkillsLoading(true);
        const res = await getProjectSkills(projectId);
        if (res.data?.success) {
          setSkills(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Skills.");
      } finally {
        setSkillsLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setKnowledgeLoading(true);
        const res = await getProjectKnowledge(projectId);
        if (res.data?.success) {
          setKnowledgeBases(res.data.data);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load Knowledge Bases.",
        );
      } finally {
        setKnowledgeLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setMcpsLoading(true);
        const res = await getProjectMcps(projectId);
        if (res.data?.success) {
          setMcps(res.data.data);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load Connectors.",
        );
      } finally {
        setMcpsLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setProvidersLoading(true);
        const res = await getProjectProviders(projectId);
        if (res.data?.success) {
          setProviders(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Providers.");
      } finally {
        setProvidersLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  const openEdit = () => {
    setEditForm({
      name: project.name || "",
      slug: project.slug || "",
      description: project.description || "",
    });
    setEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = { ...editForm };
      if (!dataToSubmit.slug) delete dataToSubmit.slug;
      const res = await updateProject(projectId, dataToSubmit);
      setProject(res.data.data);
      toast.success("Project updated.");
      setEditOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update Project.");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    setActionBusy(true);
    try {
      const res = await suspendProject(projectId);
      setProject(res.data.data);
      toast.success("Project suspended.");
      setSuspendOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to suspend Project.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactivate = async () => {
    setActionBusy(true);
    try {
      const res = await reactivateProject(projectId);
      setProject(res.data.data);
      toast.success("Project reactivated.");
      setReactivateOpen(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to reactivate Project.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelDeletion = async () => {
    setActionBusy(true);
    try {
      const res = await cancelProjectDeletion(projectId);
      setProject(res.data.data);
      toast.success("Deletion cancelled — Project is ACTIVE again.");
      setCancelDeletionOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel deletion.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm.");
      return;
    }
    setActionBusy(true);
    try {
      const res = await requestProjectDeletion(projectId);
      setProject(res.data.data);
      toast.success("Project deletion requested.");
      setDeleteOpen(false);
      setDeleteConfirmText("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request deletion.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberId.trim()) return;
    setAddingMember(true);
    try {
      const res = await addProjectMember(projectId, newMemberId.trim());
      setMembers((prev) => [...prev, res.data.data]);
      toast.success("Admin added.");
      setAddMemberOpen(false);
      setNewMemberId("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add Admin.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemovingMember(true);
    try {
      await removeProjectMember(projectId, removeMemberTarget.personaUserId);
      setMembers((prev) =>
        prev.filter(
          (m) => m.personaUserId !== removeMemberTarget.personaUserId,
        ),
      );
      toast.success("Member removed.");
      setRemoveMemberTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member.");
    } finally {
      setRemovingMember(false);
    }
  };

  const handleMintCredential = async (e) => {
    e.preventDefault();
    setMinting(true);
    try {
      const res = await mintProjectCredential(
        projectId,
        mintLabel.trim() || undefined,
      );
      const created = res.data.data;
      setCredentials((prev) => [created, ...prev]);
      setMintedSecret({ keyId: created.keyId, secret: created.secret });
      setMintOpen(false);
      setMintLabel("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mint credential.");
    } finally {
      setMinting(false);
    }
  };

  const handleRevokeCredential = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await revokeProjectCredential(projectId, revokeTarget.id);
      setCredentials((prev) =>
        prev.map((c) => (c.id === res.data.data.id ? res.data.data : c)),
      );
      toast.success("Credential revoked.");
      setRevokeTarget(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to revoke credential.",
      );
    } finally {
      setRevoking(false);
    }
  };

  const handleCopySecret = () => {
    if (!mintedSecret) return;
    navigator.clipboard.writeText(mintedSecret.secret);
    toast.success("Copied to clipboard");
  };

  const handleDeleteProvider = async () => {
    if (!deleteProviderTarget) return;
    setDeletingProvider(true);
    try {
      await deleteProjectProvider(projectId, deleteProviderTarget.id);
      setProviders((prev) =>
        prev.filter((p) => p.id !== deleteProviderTarget.id),
      );
      toast.success("Provider deleted.");
      setDeleteProviderTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete Provider.");
    } finally {
      setDeletingProvider(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (!deleteSkillTarget) return;
    setDeletingSkill(true);
    try {
      const targetId = deleteSkillTarget._id || deleteSkillTarget.id;
      await deleteProjectSkill(projectId, targetId);
      setSkills((prev) => prev.filter((s) => (s._id || s.id) !== targetId));
      toast.success("Skill deleted.");
      setDeleteSkillTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete Skill.");
    } finally {
      setDeletingSkill(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const canReactivate = project.suspendedByAuthority === "ProjectAdmin";
  const canDelete =
    project.status === "ACTIVE" || project.status === "SUSPENDED";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href={developerRoutes.projects}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
        <Badge
          variant={STATUS_BADGE_VARIANT[project.status] || "outline"}
          className={STATUS_BADGE_CLASSNAME[project.status]}
        >
          {project.status}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Project Details</CardTitle>
                <CardDescription>
                  Metadata visible to this Project&apos;s Admins and Members.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground">Slug</span>
                <p>{project.slug || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Description</span>
                <p className="whitespace-pre-wrap">
                  {project.description || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p>
                  {project.createdAt
                    ? new Date(project.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl border-destructive/20">
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>
              <CardDescription>
                Actions that change this Project&apos;s availability. Suspending
                or deleting a Project immediately stops its credentials from
                authenticating.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {project.status === "ACTIVE" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Suspend Project</p>
                    <p className="text-sm text-muted-foreground">
                      Temporarily stop this Project&apos;s credentials from
                      authenticating. Reversible.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSuspendOpen(true)}
                  >
                    <PauseCircle className="mr-1.5 size-4" />
                    Suspend
                  </Button>
                </div>
              )}

              {project.status === "SUSPENDED" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Reactivate Project</p>
                    <p className="text-sm text-muted-foreground">
                      {canReactivate
                        ? "Restore this Project to ACTIVE."
                        : "This Project was suspended by a Platform Admin and can only be restored by one — contact support."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!canReactivate}
                    onClick={() => setReactivateOpen(true)}
                  >
                    <PlayCircle className="mr-1.5 size-4" />
                    Reactivate
                  </Button>
                </div>
              )}

              {project.status === "DELETING" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Cancel Deletion</p>
                    <p className="text-sm text-muted-foreground">
                      Deletion requested
                      {project.deletionRequestedAt
                        ? ` on ${new Date(project.deletionRequestedAt).toLocaleString()}`
                        : ""}
                      . You can cancel it while the grace period is still open.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCancelDeletionOpen(true)}
                  >
                    <Undo2 className="mr-1.5 size-4" />
                    Cancel Deletion
                  </Button>
                </div>
              )}

              {project.status === "DELETED" && (
                <p className="text-sm text-muted-foreground">
                  This Project has been deleted and can no longer be
                  administered.
                </p>
              )}

              {canDelete && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="font-medium text-destructive">
                      Delete Project
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Starts a grace-period deletion. Credentials stop
                      authenticating immediately; cancellable until the grace
                      period elapses.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-1.5 size-4" />
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  Admins who can manage this Project via their own Clerk
                  session. v1 adds by internal Persona User id only — no email
                  lookup yet.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="mr-1.5 size-3.5" />
                Add Admin
              </Button>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.personaUserId}>
                        <TableCell className="font-mono text-xs">
                          {m.personaUserId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.createdAt
                            ? new Date(m.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRemoveMemberTarget(m)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Credentials</CardTitle>
                <CardDescription>
                  API credentials this Project&apos;s SDK uses to authenticate —
                  separate from your own Clerk session used here in Studio.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setMintOpen(true)}>
                <KeyRound className="mr-1.5 size-3.5" />
                Mint new
              </Button>
            </CardHeader>
            <CardContent>
              {credentialsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : credentials.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key ID</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">
                          {c.keyId}
                        </TableCell>
                        <TableCell>{c.label || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              CREDENTIAL_BADGE_VARIANT[c.status] || "outline"
                            }
                            className={CREDENTIAL_BADGE_CLASSNAME[c.status]}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.lastUsedAt
                            ? new Date(c.lastUsedAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRevokeTarget(c)}
                            >
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No credentials yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                Agents this Project owns — read-only. Creating and editing
                Agents stays an SDK/API-key operation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={agents}
                loading={agentsLoading}
                emptyLabel="No Agents yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Skills</CardTitle>
                <CardDescription>Skills this Project owns.</CardDescription>
              </div>
              <Link href={developerRoutes.projectSkillNew(projectId)}>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  New Skill
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={skills}
                loading={skillsLoading}
                emptyLabel="No Skills yet."
                getEditHref={(id) =>
                  developerRoutes.projectSkillEdit(projectId, id)
                }
                onDelete={(skill) => setDeleteSkillTarget(skill)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Knowledge</CardTitle>
                <CardDescription>
                  Knowledge Bases this Project owns.
                </CardDescription>
              </div>
              <Link href={developerRoutes.projectKnowledgeNew(projectId)}>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  New Knowledge Base
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={knowledgeBases}
                loading={knowledgeLoading}
                emptyLabel="No Knowledge Bases yet."
                getEditHref={(id) =>
                  developerRoutes.projectKnowledgeDetail(projectId, id)
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectors" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Connectors</CardTitle>
              <CardDescription>
                MCP connectors this Project owns — read-only. Creating and
                editing connectors stays an SDK/API-key operation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={mcps}
                loading={mcpsLoading}
                emptyLabel="No Connectors yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Providers</CardTitle>
                <CardDescription>
                  AI providers this Project owns.
                </CardDescription>
              </div>
              <Link href={developerRoutes.projectProviderNew(projectId)}>
                <Button size="sm">
                  <Plus className="mr-1.5 size-3.5" />
                  New Provider
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {providersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : providers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Default Model
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Created
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.baseURL}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {p.defaultModel || "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link
                              href={developerRoutes.projectProviderEdit(
                                projectId,
                                p.id,
                              )}
                            >
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteProviderTarget(p)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Providers yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit metadata */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>
                Update this Project&apos;s display metadata.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  id="edit-name"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-slug">Slug</FieldLabel>
                <Input
                  id="edit-slug"
                  name="slug"
                  value={editForm.slug}
                  onChange={handleEditChange}
                  maxLength={100}
                />
                <FieldDescription>
                  Optional — display/routing convenience only.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                <Textarea
                  id="edit-description"
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  maxLength={1000}
                  rows={3}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend this Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Its credentials will immediately stop authenticating. You can
              reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSuspend();
              }}
              disabled={actionBusy}
            >
              {actionBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Suspend"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate */}
      <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate this Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Its credentials will resume authenticating immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReactivate();
              }}
              disabled={actionBusy}
            >
              {actionBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Reactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel deletion */}
      <AlertDialog
        open={cancelDeletionOpen}
        onOpenChange={setCancelDeletionOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel pending deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              This Project will return to ACTIVE and its credentials will resume
              authenticating.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>
              Keep pending
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelDeletion();
              }}
              disabled={actionBusy}
            >
              {actionBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Cancel Deletion"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete this Project?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This starts a grace-period deletion. Its credentials stop
              authenticating immediately, and all owned resources will
              eventually be permanently removed. You can cancel while the grace
              period is open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <p className="text-sm font-medium">
              Please type <span className="font-bold">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="border-destructive focus-visible:ring-destructive"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={actionBusy}
              onClick={() => setDeleteConfirmText("")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={actionBusy || deleteConfirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Admin */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>Add Admin</DialogTitle>
              <DialogDescription>
                Grants Admin membership to an existing Persona User by their
                internal id.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="new-member-id">Persona User ID</FieldLabel>
                <Input
                  id="new-member-id"
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  placeholder="e.g. 64f1c2..."
                  required
                />
                <FieldDescription>
                  v1 has no email lookup — use the internal Persona User id.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddMemberOpen(false)}
                disabled={addingMember}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingMember}>
                {addingMember && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member */}
      <AlertDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMemberTarget?.personaUserId} will lose Admin access to this
              Project. The last remaining Admin cannot be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemoveMember();
              }}
              disabled={removingMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingMember ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mint credential */}
      <Dialog open={mintOpen} onOpenChange={setMintOpen}>
        <DialogContent>
          <form onSubmit={handleMintCredential}>
            <DialogHeader>
              <DialogTitle>Mint new credential</DialogTitle>
              <DialogDescription>
                The secret is shown exactly once right after this — copy it
                immediately, it can never be retrieved again.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="mint-label">Label</FieldLabel>
                <Input
                  id="mint-label"
                  value={mintLabel}
                  onChange={(e) => setMintLabel(e.target.value)}
                  placeholder="e.g. Production backend"
                  maxLength={100}
                />
                <FieldDescription>
                  Optional — helps you identify this credential later.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMintOpen(false)}
                disabled={minting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={minting}>
                {minting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time secret reveal */}
      <Dialog
        open={!!mintedSecret}
        onOpenChange={(open) => !open && setMintedSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Save this secret now
            </DialogTitle>
            <DialogDescription>
              This is the only time this secret will ever be shown. Store it
              somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Key ID</p>
              <p className="font-mono text-sm">{mintedSecret?.keyId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {mintedSecret?.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setMintedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke credential */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this credential?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.label || revokeTarget?.keyId} will immediately stop
              authenticating. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevokeCredential();
              }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Revoke"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete provider */}
      <AlertDialog
        open={!!deleteProviderTarget}
        onOpenChange={(open) => !open && setDeleteProviderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Provider?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProviderTarget?.label} will be permanently deleted. Any
              Agents still using it will need a new Provider assigned. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProvider}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProvider();
              }}
              disabled={deletingProvider}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProvider ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete skill */}
      <AlertDialog
        open={!!deleteSkillTarget}
        onOpenChange={(open) => !open && setDeleteSkillTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Skill?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSkillTarget?.name} will be permanently deleted. Any Agents
              still referencing it will lose access to it. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSkill}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSkill();
              }}
              disabled={deletingSkill}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSkill ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
