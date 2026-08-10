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
  Plus,
  Zap,
  MessageSquare,
  Mail,
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
  searchProjectMembers,
  removeProjectMember,
  inviteProjectMember,
  getProjectInvitations,
  revokeProjectInvitation,
  getProjectCredentials,
  mintProjectCredential,
  revokeProjectCredential,
  getProjectAgents,
  getProjectSkills,
  getProjectKnowledge,
  getProjectMcps,
  getProjectProviders,
  getProjectStores,
  deleteProjectProvider,
  deleteProjectSkill,
  deleteProjectMcp,
  deleteProjectAgent,
  deleteProjectStore,
  testProjectProviderConnection,
  getProjectAuditLogs,
  bulkDeleteProjectAgents,
  bulkDeleteProjectSkills,
  bulkDeleteProjectMcps,
  bulkDeleteProjectProviders,
  getProjectProviderUsage,
  getProjectSkillUsage,
  getProjectMcpUsage,
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
import { CopyButton } from "@/components/ui/copy-button";
import { Checkbox } from "@/components/ui/checkbox";
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

// Matches the brand-blue CTA treatment used throughout the sidebar
// (nav-main.jsx, developer-sidebar.jsx) — applied to this page's primary
// "New X" / mutating actions so Studio's own content reads as consistent
// with the rest of the app, not just its nav.
const PRIMARY_CTA_CLASSNAME =
  "!bg-[#1E60FF] !text-white font-bold shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]";

// Agents/Skills/Knowledge/Connectors all share a name+description+createdAt
// shape for read-only browsing — one small table renderer instead of
// repeating the same JSX four times.
//
// Bulk-select is opt-in via `onBulkDelete` (id[]) => Promise — Knowledge and
// Stores don't pass it (Knowledge has no list-level delete at all yet;
// Stores has no bulk-delete backend route), so they render exactly as
// before with no checkbox column.
function NameDescriptionTable({
  items,
  loading,
  emptyLabel,
  getEditHref,
  getTestHref,
  onDelete,
  onBulkDelete,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Selection doesn't survive a data refresh (e.g. after a bulk delete) —
  // stale ids in the set would silently no-op on their next click.
  useEffect(() => {
    setSelected(new Set());
  }, [items]);

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
  const showActions = !!(getEditHref || getTestHref || onDelete);
  const selectable = !!onBulkDelete;

  const allIds = items.map((item) => item._id || item.id);
  const allSelected =
    selectable && selected.size > 0 && selected.size === allIds.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await onBulkDelete(Array.from(selected));
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      {selectable && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
          >
            {bulkDeleting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 size-3.5" />
            )}
            Delete {selected.size} selected
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead className="hidden lg:table-cell">ID</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            {showActions && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const id = item._id || item.id;
            return (
              <TableRow key={id}>
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(id)}
                      onCheckedChange={() => toggleOne(id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <CopyButton
                    value={id}
                    label={`${item.name || "Resource"} ID`}
                    variant="inline"
                    className="max-w-[160px]"
                  />
                </TableCell>
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
                      {getTestHref && (
                        <Link href={getTestHref(id)}>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="mr-1.5 size-3.5" />
                            Test
                          </Button>
                        </Link>
                      )}
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
    </div>
  );
}

// Fetches getUsage for whatever's about to be deleted and shows how many
// Agents still reference it, right inside the confirm dialog — the whole
// point of getUsage existing is to stop someone deleting a Provider/Skill/
// Connector out from under Agents that are still using it. `id` is `null`
// while nothing's targeted (dialog closed) — skip the fetch, render
// nothing. `getUsage` is one of the stable, module-level API functions
// (getProjectProviderUsage etc.), not a per-render closure, so it's safe
// as an effect dependency.
function UsageWarning({ getUsage, projectId, id }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getUsage(projectId, id);
        if (!cancelled) setUsage(res.data?.data ?? null);
      } catch {
        if (!cancelled) setUsage(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getUsage, projectId, id]);

  if (!id || loading) return null;
  if (!usage || usage.agentCount === 0) return null;

  const names = usage.agents?.map((a) => a.name).join(", ") || "";
  const more = usage.agentCount > (usage.agents?.length || 0);

  return (
    <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-500">
      Used by {usage.agentCount} Agent{usage.agentCount === 1 ? "" : "s"}
      {names ? `: ${names}${more ? ", …" : ""}` : ""}
    </p>
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
  const [memberQuery, setMemberQuery] = useState("");
  const [memberMode, setMemberMode] = useState("email");
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [memberSearching, setMemberSearching] = useState(false);
  // Set when the admin picks an autocomplete suggestion; typing again clears
  // it so the debounced search doesn't immediately re-fire on the picked
  // email and re-show the dropdown.
  const [memberPickedEmail, setMemberPickedEmail] = useState(null);
  const [addingMember, setAddingMember] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);

  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitingEmail, setInvitingEmail] = useState("");
  const [revokeInvitationTarget, setRevokeInvitationTarget] = useState(null);
  const [revokingInvitation, setRevokingInvitation] = useState(false);

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
  const [deleteAgentTarget, setDeleteAgentTarget] = useState(null);
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [deleteSkillTarget, setDeleteSkillTarget] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [mcps, setMcps] = useState([]);
  const [mcpsLoading, setMcpsLoading] = useState(true);
  const [deleteMcpTarget, setDeleteMcpTarget] = useState(null);
  const [deletingMcp, setDeletingMcp] = useState(false);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [deleteProviderTarget, setDeleteProviderTarget] = useState(null);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState(
    () => new Set(),
  );
  const [bulkDeletingProviders, setBulkDeletingProviders] = useState(false);
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [deleteStoreTarget, setDeleteStoreTarget] = useState(null);
  const [deletingStore, setDeletingStore] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(true);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsPages, setAuditLogsPages] = useState(1);

  useDashboardHeader(
    {
      title: project?.name || "Project",
      description: "Manage this Project's metadata and lifecycle.",
      actions: project ? (
        <div className="flex items-center gap-3">
          <Link
            href={developerRoutes.projects}
            className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Projects
          </Link>
          <Badge
            variant={STATUS_BADGE_VARIANT[project.status] || "outline"}
            className={STATUS_BADGE_CLASSNAME[project.status]}
          >
            {project.status}
          </Badge>
        </div>
      ) : null,
    },
    [project?.name, project?.status],
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
        setInvitationsLoading(true);
        const res = await getProjectInvitations(projectId);
        if (res.data?.success) {
          setInvitations(res.data.data);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load invitations.",
        );
      } finally {
        setInvitationsLoading(false);
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
        setStoresLoading(true);
        const res = await getProjectStores(projectId);
        if (res.data?.success) {
          setStores(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Stores.");
      } finally {
        setStoresLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setAuditLogsLoading(true);
        const res = await getProjectAuditLogs(projectId, {
          page: auditLogsPage,
          limit: 20,
        });
        if (res.data?.success) {
          setAuditLogs(res.data.data.items);
          setAuditLogsPages(res.data.data.pagination.pages || 1);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load audit logs.",
        );
      } finally {
        setAuditLogsLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, projectId, auditLogsPage]);

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
    const value = memberQuery.trim();
    if (!value) return;
    setAddingMember(true);
    try {
      const payload =
        memberMode === "id" ? { personaUserId: value } : { email: value };
      const res = await addProjectMember(projectId, payload);
      setMembers((prev) => [...prev, res.data.data]);
      toast.success("Admin added.");
      setAddMemberOpen(false);
      setMemberQuery("");
      setMemberSuggestions([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add Admin.");
    } finally {
      setAddingMember(false);
    }
  };

  // Debounced email autocomplete for the "Add Admin" dialog. Only fires in
  // email mode with a 3+ char prefix; suggestions clear when the dialog
  // closes or the mode switches to raw User id.
  useEffect(() => {
    if (memberMode !== "email" || !addMemberOpen) {
      setMemberSuggestions([]);
      return;
    }
    const q = memberQuery.trim().toLowerCase();
    if (q.length < 3 || (memberPickedEmail && q === memberPickedEmail)) {
      setMemberSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const res = await searchProjectMembers(projectId, q);
        if (!cancelled) setMemberSuggestions(res.data?.data ?? []);
      } catch {
        if (!cancelled) setMemberSuggestions([]);
      } finally {
        if (!cancelled) setMemberSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery, memberMode, addMemberOpen, memberPickedEmail, projectId]);

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

  const handleInviteMember = async (email) => {
    const value = email?.trim();
    if (!value) return;
    setInvitingEmail(value);
    try {
      const res = await inviteProjectMember(projectId, value);
      setInvitations((prev) => [res.data.data, ...prev]);
      toast.success(`Invitation sent to ${value}.`);
      setAddMemberOpen(false);
      setMemberQuery("");
      setMemberSuggestions([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setInvitingEmail("");
    }
  };

  const handleRevokeInvitation = async () => {
    if (!revokeInvitationTarget) return;
    setRevokingInvitation(true);
    try {
      const targetId = revokeInvitationTarget._id || revokeInvitationTarget.id;
      await revokeProjectInvitation(projectId, targetId);
      setInvitations((prev) =>
        prev.filter((i) => (i._id || i.id) !== targetId),
      );
      toast.success("Invitation revoked.");
      setRevokeInvitationTarget(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to revoke invitation.",
      );
    } finally {
      setRevokingInvitation(false);
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

  const toggleAllProviders = () => {
    setSelectedProviderIds((prev) =>
      prev.size === providers.length
        ? new Set()
        : new Set(providers.map((p) => p.id)),
    );
  };
  const toggleOneProvider = (id) => {
    setSelectedProviderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleBulkDeleteProvidersClick = async () => {
    setBulkDeletingProviders(true);
    try {
      await handleBulkDeleteProviders(Array.from(selectedProviderIds));
      setSelectedProviderIds(new Set());
    } finally {
      setBulkDeletingProviders(false);
    }
  };

  const handleTestProviderConnection = async (provider) => {
    setTestingProviderId(provider.id);
    try {
      const res = await testProjectProviderConnection(projectId, provider.id);
      const result = res.data?.data;
      if (result?.success === false) {
        toast.error(
          result?.message || `Couldn't connect to ${provider.label}.`,
        );
      } else {
        toast.success(`${provider.label} connection OK.`);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || `Couldn't connect to ${provider.label}.`,
      );
    } finally {
      setTestingProviderId(null);
    }
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

  const handleDeleteStore = async () => {
    if (!deleteStoreTarget) return;
    setDeletingStore(true);
    try {
      const targetId = deleteStoreTarget._id || deleteStoreTarget.id;
      await deleteProjectStore(projectId, targetId);
      setStores((prev) => prev.filter((s) => (s._id || s.id) !== targetId));
      toast.success("Store deleted.");
      setDeleteStoreTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete Store.");
    } finally {
      setDeletingStore(false);
    }
  };

  const handleDeleteMcp = async () => {
    if (!deleteMcpTarget) return;
    setDeletingMcp(true);
    try {
      const targetId = deleteMcpTarget._id || deleteMcpTarget.id;
      await deleteProjectMcp(projectId, targetId);
      setMcps((prev) => prev.filter((m) => (m._id || m.id) !== targetId));
      toast.success("Connector deleted.");
      setDeleteMcpTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete Connector.");
    } finally {
      setDeletingMcp(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteAgentTarget) return;
    setDeletingAgent(true);
    try {
      const targetId = deleteAgentTarget._id || deleteAgentTarget.id;
      await deleteProjectAgent(projectId, targetId);
      setAgents((prev) => prev.filter((a) => (a._id || a.id) !== targetId));
      toast.success("Agent deleted.");
      setDeleteAgentTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete Agent.");
    } finally {
      setDeletingAgent(false);
    }
  };

  // Shared shape for every bulk-delete: call the API, drop the deleted ids
  // from local state, report partial failures (a blocked/not-found id
  // shouldn't silently vanish from the toast) — bulkDelete on the backend
  // is best-effort per-id (Promise.allSettled), never all-or-nothing.
  const runBulkDelete = async (apiCall, ids, setItems, resourceLabel) => {
    const res = await apiCall(projectId, ids);
    const { deleted, failed } = res.data.data;
    if (deleted.length > 0) {
      const deletedSet = new Set(deleted);
      setItems((prev) =>
        prev.filter((item) => !deletedSet.has(item._id || item.id)),
      );
    }
    if (failed.length === 0) {
      toast.success(
        `${deleted.length} ${resourceLabel}${deleted.length === 1 ? "" : "s"} deleted.`,
      );
    } else {
      toast.error(
        `${deleted.length} deleted, ${failed.length} couldn't be deleted (still in use, or not found).`,
      );
    }
  };

  const handleBulkDeleteAgents = (ids) =>
    runBulkDelete(bulkDeleteProjectAgents, ids, setAgents, "Agent");
  const handleBulkDeleteSkills = (ids) =>
    runBulkDelete(bulkDeleteProjectSkills, ids, setSkills, "Skill");
  const handleBulkDeleteMcps = (ids) =>
    runBulkDelete(bulkDeleteProjectMcps, ids, setMcps, "Connector");
  const handleBulkDeleteProviders = (ids) =>
    runBulkDelete(bulkDeleteProjectProviders, ids, setProviders, "Provider");

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

  // Users already holding a membership — the Add Admin autocomplete marks
  // them as already-member so a duplicate invite can't be offered (the
  // backend enforces the same rule via the unique compound index).
  const memberPersonaIds = new Set(members.map((m) => m.personaUserId));

  // Only invitations that are still awaiting acceptance are actionable.
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Tabs defaultValue="overview">
        <TabsList variant="pill">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
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
                  session. Add by email (search as you type) or paste an
                  internal Persona User id.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className={PRIMARY_CTA_CLASSNAME}
                onClick={() => setAddMemberOpen(true)}
              >
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

          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  Pending Invitations
                </CardTitle>
                <CardDescription>
                  People invited by email who haven&apos;t created an account
                  yet. Clerk emails them an accept link.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : pendingInvitations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Invited
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((inv) => (
                      <TableRow key={inv._id || inv.id}>
                        <TableCell className="font-medium">
                          {inv.email}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {inv.createdAt
                            ? new Date(inv.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevokeInvitationTarget(inv)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pending invitations.
                </p>
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
              <Button
                size="sm"
                className={PRIMARY_CTA_CLASSNAME}
                onClick={() => setMintOpen(true)}
              >
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
                        <TableCell>
                          <CopyButton
                            value={c.keyId}
                            label="Key ID"
                            variant="inline"
                            className="max-w-[180px]"
                          />
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
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Agents</CardTitle>
                <CardDescription>Agents this Project owns.</CardDescription>
              </div>
              <Link href={developerRoutes.projectAgentNew(projectId)}>
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
                  <Plus className="mr-1.5 size-3.5" />
                  New Agent
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={agents}
                loading={agentsLoading}
                emptyLabel="No Agents yet."
                getEditHref={(id) =>
                  developerRoutes.projectAgentEdit(projectId, id)
                }
                getTestHref={(id) =>
                  developerRoutes.projectAgentTest(projectId, id)
                }
                onDelete={(agent) => setDeleteAgentTarget(agent)}
                onBulkDelete={handleBulkDeleteAgents}
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
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
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
                onBulkDelete={handleBulkDeleteSkills}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Stores</CardTitle>
                <CardDescription>
                  Named, scoped mount points Agents can be assigned to (see
                  storeMounts on the Agent edit form).
                </CardDescription>
              </div>
              <Link href={developerRoutes.projectStoreNew(projectId)}>
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
                  <Plus className="mr-1.5 size-3.5" />
                  New Store
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={stores.map((s) => ({
                  ...s,
                  description: [
                    s.description,
                    `scope: ${s.scope}`,
                    `access: ${s.accessMode}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                loading={storesLoading}
                emptyLabel="No Stores yet."
                getEditHref={(id) =>
                  developerRoutes.projectStoreEdit(projectId, id)
                }
                onDelete={(store) => setDeleteStoreTarget(store)}
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
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
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
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Connectors</CardTitle>
                <CardDescription>
                  MCP connectors this Project owns.
                </CardDescription>
              </div>
              <Link href={developerRoutes.projectMcpNew(projectId)}>
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
                  <Plus className="mr-1.5 size-3.5" />
                  New Connector
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <NameDescriptionTable
                items={mcps}
                loading={mcpsLoading}
                emptyLabel="No Connectors yet."
                getEditHref={(id) =>
                  developerRoutes.projectMcpEdit(projectId, id)
                }
                onDelete={(mcp) => setDeleteMcpTarget(mcp)}
                onBulkDelete={handleBulkDeleteMcps}
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
                <Button size="sm" className={PRIMARY_CTA_CLASSNAME}>
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
                <div className="space-y-2">
                  {selectedProviderIds.size > 0 && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedProviderIds.size} selected
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={bulkDeletingProviders}
                        onClick={handleBulkDeleteProvidersClick}
                      >
                        {bulkDeletingProviders ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1.5 size-3.5" />
                        )}
                        Delete {selectedProviderIds.size} selected
                      </Button>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              selectedProviderIds.size > 0 &&
                              selectedProviderIds.size === providers.length
                            }
                            onCheckedChange={toggleAllProviders}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          ID
                        </TableHead>
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
                          <TableCell>
                            <Checkbox
                              checked={selectedProviderIds.has(p.id)}
                              onCheckedChange={() => toggleOneProvider(p.id)}
                              aria-label={`Select ${p.label}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.label}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <CopyButton
                              value={p.id}
                              label={`${p.label || "Provider"} ID`}
                              variant="inline"
                              className="max-w-[160px]"
                            />
                          </TableCell>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={testingProviderId === p.id}
                                onClick={() => handleTestProviderConnection(p)}
                              >
                                {testingProviderId === p.id ? (
                                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                ) : (
                                  <Zap className="mr-1.5 size-3.5" />
                                )}
                                Test
                              </Button>
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Providers yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-6">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                This Project&apos;s lifecycle trail — credentials minted/
                revoked, membership changes, suspend/restore. Resource CRUD
                (Agents/Skills/Knowledge/Providers/MCPs) isn&apos;t logged here
                yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : auditLogs.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Target
                        </TableHead>
                        <TableHead className="text-right">When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log._id || log.id}>
                          <TableCell>
                            <Badge variant="outline">{log.eventType}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.actorContextType}
                            {log.actorIdentity ? ` · ${log.actorIdentity}` : ""}
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                            {log.targetResourceId || "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {log.timestamp
                              ? new Date(log.timestamp).toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {auditLogsPages > 1 && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditLogsPage <= 1}
                        onClick={() => setAuditLogsPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {auditLogsPage} of {auditLogsPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditLogsPage >= auditLogsPages}
                        onClick={() => setAuditLogsPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No audit events yet.
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
              <Button
                type="submit"
                disabled={saving}
                className={PRIMARY_CTA_CLASSNAME}
              >
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
                Grants Admin membership to an existing Persona User. Search by
                email, or switch to paste an internal User id.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="new-member-id">
                  {memberMode === "email" ? "Email" : "Persona User ID"}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="new-member-id"
                    value={memberQuery}
                    onChange={(e) => {
                      setMemberQuery(e.target.value);
                      setMemberPickedEmail(null);
                    }}
                    placeholder={
                      memberMode === "email"
                        ? "e.g. sabik@beyond.campus"
                        : "e.g. 64f1c2..."
                    }
                    type={memberMode === "email" ? "email" : "text"}
                    required
                  />
                  {memberMode === "email" &&
                    !memberSearching &&
                    memberSuggestions.length === 0 &&
                    memberQuery.trim().length >= 3 &&
                    memberQuery.trim().toLowerCase() !== memberPickedEmail && (
                      <div className="mt-1 flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          No Persona account found for this email — you can
                          invite them instead.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="self-start !bg-[#1E60FF] !text-white font-bold shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]"
                          disabled={!!invitingEmail}
                          onClick={() => handleInviteMember(memberQuery)}
                        >
                          {invitingEmail ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <Mail className="mr-1.5 size-3.5" />
                          )}
                          Invite by email
                        </Button>
                      </div>
                    )}
                  {memberMode === "email" && memberSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                      {memberSuggestions.map((u) => {
                        const alreadyMember = memberPersonaIds.has(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            disabled={alreadyMember}
                            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors ${
                              alreadyMember
                                ? "cursor-not-allowed opacity-50"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => {
                              if (alreadyMember) return;
                              setMemberQuery(u.email);
                              setMemberPickedEmail(u.email.toLowerCase());
                              setMemberSuggestions([]);
                            }}
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {u.email}
                              {alreadyMember && " · Already a member"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {memberMode === "email" && memberSearching && (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <FieldDescription>
                  {memberMode === "email"
                    ? "Start typing an email — matching Persona users appear below."
                    : "Paste the internal Persona User id (shown in the Members table)."}
                </FieldDescription>
              </Field>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  setMemberMode((m) => (m === "email" ? "id" : "email"));
                  setMemberQuery("");
                  setMemberSuggestions([]);
                }}
              >
                {memberMode === "email"
                  ? "Add by internal User id instead"
                  : "Add by email instead"}
              </button>
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
              <Button
                type="submit"
                disabled={addingMember}
                className={PRIMARY_CTA_CLASSNAME}
              >
                {addingMember && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke invitation */}
      <AlertDialog
        open={!!revokeInvitationTarget}
        onOpenChange={(open) => !open && setRevokeInvitationTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeInvitationTarget?.email} will no longer be able to accept —
              their emailed link stops working immediately. You can invite them
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingInvitation}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevokeInvitation();
              }}
              disabled={revokingInvitation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokingInvitation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Revoke"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <Button
                type="submit"
                disabled={minting}
                className={PRIMARY_CTA_CLASSNAME}
              >
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
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {mintedSecret?.keyId}
                </code>
                <CopyButton
                  value={mintedSecret?.keyId}
                  label="Key ID"
                  className="border border-input"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {mintedSecret?.secret}
                </code>
                <CopyButton
                  value={mintedSecret?.secret}
                  label="Secret"
                  className="border border-input"
                />
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
            <UsageWarning
              getUsage={getProjectProviderUsage}
              projectId={projectId}
              id={deleteProviderTarget?.id}
            />
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
            <UsageWarning
              getUsage={getProjectSkillUsage}
              projectId={projectId}
              id={deleteSkillTarget?._id || deleteSkillTarget?.id}
            />
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

      {/* Delete store */}
      <AlertDialog
        open={!!deleteStoreTarget}
        onOpenChange={(open) => !open && setDeleteStoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Store?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteStoreTarget?.name} and all of its data will be permanently
              deleted, and it will be removed from every Agent that mounts it.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingStore}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteStore();
              }}
              disabled={deletingStore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingStore ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete connector */}
      <AlertDialog
        open={!!deleteMcpTarget}
        onOpenChange={(open) => !open && setDeleteMcpTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Connector?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMcpTarget?.name} will be permanently deleted, including any
              owner OAuth connection. Any Agents still attaching it will lose
              access to its tools. This cannot be undone.
            </AlertDialogDescription>
            <UsageWarning
              getUsage={getProjectMcpUsage}
              projectId={projectId}
              id={deleteMcpTarget?._id || deleteMcpTarget?.id}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMcp}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteMcp();
              }}
              disabled={deletingMcp}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMcp ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete agent */}
      <AlertDialog
        open={!!deleteAgentTarget}
        onOpenChange={(open) => !open && setDeleteAgentTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAgentTarget?.name} will be permanently deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAgent}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAgent();
              }}
              disabled={deletingAgent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAgent ? (
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
