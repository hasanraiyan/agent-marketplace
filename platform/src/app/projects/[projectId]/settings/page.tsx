"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { GearIcon, PencilSimpleIcon, PauseCircleIcon, PlayCircleIcon, TrashIcon, WarningCircleIcon, CheckCircleIcon, ClockIcon, FingerprintIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getProject,
  updateProject,
  suspendProject,
  reactivateProject,
  requestProjectDeletion,
  cancelProjectDeletion,
} from "@/lib/api/projects";
import { getCached, setCached, dedupedFetch, cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface Project {
  _id: string;
  id?: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETING" | "DELETED" | string;
  createdAt: string;
  suspendedAt?: string | null;
  suspendedByAuthority?: string | null;
  suspendedByPersonaUserId?: string | null;
  deletionRequestedAt?: string | null;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function statusBadgeVariant(status: string) {
  if (status === "ACTIVE") return "outline" as const;
  if (status === "SUSPENDED") return "secondary" as const;
  if (status === "DELETING") return "secondary" as const;
  if (status === "DELETED") return "outline" as const;
  return "outline" as const;
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (status === "DELETING") return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "DELETED") return "bg-secondary text-secondary-foreground";
  return "";
}

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({ name: "", slug: "", description: "" });
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reactivateOpen, setReactivateOpen] = React.useState(false);
  const [cancelDeletionOpen, setCancelDeletionOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [actionBusy, setActionBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fetchProject = React.useCallback(async (useCache = true) => {
    const key = cacheKey.project(projectId);
    if (useCache) {
      const cached = getCached<Project>(key);
      if (cached) {
        setProject(cached);
        setLoading(false);
      }
    }
    try {
      const data = await dedupedFetch<Project>(key, () => getProject(projectId).then((r) => r.data?.data as Project));
      setCached(key, data);
      setProject(data);
      setLoadError(null);
    } catch (err) {
      if (!useCache || !getCached(key)) setLoadError(errorMessage(err, "Failed to load project."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchProject(true);
  }, [fetchProject]);

  const openEdit = () => {
    if (!project) return;
    setEditForm({ name: project.name || "", slug: project.slug || "", description: project.description || "" });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const data: Record<string, string> = { ...editForm };
      if (!data.slug?.trim()) delete data.slug;
      else data.slug = data.slug.trim().toLowerCase();
      const res = await updateProject(projectId, data);
      const updated = res.data?.data as Project;
      setProject(updated);
      setCached(cacheKey.project(projectId), updated);
      deleteCachedByPrefix(cacheKey.projects());
      setEditOpen(false);
    } catch (err) {
      setEditError(errorMessage(err, "Failed to update project."));
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await suspendProject(projectId);
      const updated = res.data?.data as Project;
      setProject(updated);
      setCached(cacheKey.project(projectId), updated);
      deleteCachedByPrefix(cacheKey.projects());
      setSuspendOpen(false);
    } catch (err) {
      setActionError(errorMessage(err, "Failed to suspend project."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactivate = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await reactivateProject(projectId);
      const updated = res.data?.data as Project;
      setProject(updated);
      setCached(cacheKey.project(projectId), updated);
      deleteCachedByPrefix(cacheKey.projects());
      setReactivateOpen(false);
    } catch (err) {
      setActionError(errorMessage(err, "Failed to reactivate project."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelDeletion = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await cancelProjectDeletion(projectId);
      const updated = res.data?.data as Project;
      setProject(updated);
      setCached(cacheKey.project(projectId), updated);
      deleteCachedByPrefix(cacheKey.projects());
      setCancelDeletionOpen(false);
    } catch (err) {
      setActionError(errorMessage(err, "Failed to cancel deletion."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== "DELETE") {
      setActionError("Please type DELETE to confirm.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await requestProjectDeletion(projectId);
      const updated = res.data?.data as Project;
      setProject(updated);
      setCached(cacheKey.project(projectId), updated);
      deleteCachedByPrefix(cacheKey.projects());
      setDeleteOpen(false);
      setDeleteConfirmText("");
    } catch (err) {
      setActionError(errorMessage(err, "Failed to request deletion."));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Skeleton className="h-[220px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Failed to load project</CardTitle>
            <CardDescription>{loadError ?? "Project not found."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const canReactivate = project.suspendedByAuthority === "ProjectAdmin";
  const canDelete = project.status === "ACTIVE" || project.status === "SUSPENDED";

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <GearIcon />
          </span>
          <span className="truncate">Settings</span>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Manage this Project&apos;s metadata and lifecycle.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusBadgeVariant(project.status)} className={statusBadgeClass(project.status)}>
          {project.status}
        </Badge>
        {project.status === "SUSPENDED" && project.suspendedByAuthority && (
          <span className="truncate text-xs text-muted-foreground">by {project.suspendedByAuthority}</span>
        )}
      </div>

      <Separator />

      {actionError && (
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription className="break-all">{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <Card id="project-details">
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="truncate text-base sm:text-sm">Project Details</CardTitle>
              <CardDescription className="line-clamp-2 text-xs sm:line-clamp-none">Metadata visible to this Project&apos;s Admins and Members.</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-fit shrink-0" onClick={openEdit}>
              <PencilSimpleIcon data-icon="inline-start" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="font-medium">{project.name || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{project.slug || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Description</span>
              <p className="whitespace-pre-wrap text-sm">{project.description || "—"}</p>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClockIcon className="size-3.5" />
                Created
              </span>
              <span className="font-mono text-xs">{project.createdAt ? new Date(project.createdAt).toLocaleString() : "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FingerprintIcon className="size-3.5" />
                ID
              </span>
              <span className="font-mono text-[11px] break-all">{project._id || project.id}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20" id="project-lifecycle">
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>Actions that change this Project&apos;s availability. Suspending or deleting immediately stops its credentials from authenticating.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {project.status === "ACTIVE" && (
              <div className="flex flex-col gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-medium">
                  <PauseCircleIcon className="size-4" />
                  Suspend Project
                </h4>
                <p className="text-xs text-muted-foreground">Temporarily stop this Project&apos;s credentials from authenticating. Reversible.</p>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setSuspendOpen(true)}>
                  <PauseCircleIcon data-icon="inline-start" />
                  Suspend
                </Button>
              </div>
            )}

            {project.status === "SUSPENDED" && (
              <div className="flex flex-col gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-medium">
                  <PlayCircleIcon className="size-4" />
                  Reactivate Project
                </h4>
                <p className="text-xs text-muted-foreground">
                  {canReactivate ? "Restore this Project to ACTIVE." : "This Project was suspended by Platform Admin and can only be restored by Platform Admin."}
                </p>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setReactivateOpen(true)} disabled={!canReactivate}>
                  <PlayCircleIcon data-icon="inline-start" />
                  Reactivate
                </Button>
              </div>
            )}

            {project.status === "DELETING" && (
              <div className="flex flex-col gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-medium">
                  <CheckCircleIcon className="size-4" />
                  Cancel Deletion
                </h4>
                <p className="text-xs text-muted-foreground">
                  Deletion requested{project.deletionRequestedAt ? ` on ${new Date(project.deletionRequestedAt).toLocaleString()}` : ""}. You can cancel while the grace period is still open.
                </p>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setCancelDeletionOpen(true)}>
                  Cancel Deletion
                </Button>
              </div>
            )}

            {project.status === "DELETED" && (
              <Alert>
                <WarningCircleIcon />
                <AlertTitle>Deleted</AlertTitle>
                <AlertDescription>This Project has been deleted and can no longer be administered.</AlertDescription>
              </Alert>
            )}

            {canDelete && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <TrashIcon className="size-4" />
                    Delete Project
                  </h4>
                  <p className="text-xs text-muted-foreground">Starts a grace-period deletion. Credentials stop authenticating immediately; cancellable until the grace period elapses.</p>
                  <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90" onClick={() => setDeleteOpen(true)}>
                    <TrashIcon data-icon="inline-start" />
                    Delete
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update display metadata.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input id="edit-name" name="name" value={editForm.name} onChange={handleEditChange} required maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-slug">Slug</FieldLabel>
                <Input id="edit-slug" name="slug" value={editForm.slug} onChange={handleEditChange} maxLength={100} placeholder="optional" />
                <FieldDescription>Optional — lowercased, display/routing convenience only.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                <Textarea id="edit-description" name="description" value={editForm.description} onChange={handleEditChange} maxLength={1000} rows={3} placeholder="optional" />
              </Field>
            </FieldGroup>
            {editError && <FieldError>{editError}</FieldError>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend this Project?</AlertDialogTitle>
            <AlertDialogDescription>Credentials will immediately stop authenticating. You can reactivate it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} disabled={actionBusy} className="bg-amber-600 text-white hover:bg-amber-700">
              {actionBusy ? "Suspending…" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate this Project?</AlertDialogTitle>
            <AlertDialogDescription>Credentials will be able to authenticate again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate} disabled={actionBusy}>
              {actionBusy ? "Reactivating…" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDeletionOpen} onOpenChange={setCancelDeletionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel deletion?</AlertDialogTitle>
            <AlertDialogDescription>This will restore the Project to ACTIVE, regardless of whether it was SUSPENDED before.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Keep deleting</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDeletion} disabled={actionBusy}>
              {actionBusy ? "Cancelling…" : "Cancel deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Project?</AlertDialogTitle>
            <AlertDialogDescription>This starts a grace-period deletion. Credentials stop immediately. Type DELETE to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="DELETE" className="border-destructive" autoFocus />
          </div>
          {actionError && <p className="text-xs text-destructive">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy} onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={actionBusy || deleteConfirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
