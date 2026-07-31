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
} from "lucide-react";
import {
  getProject,
  updateProject,
  suspendProject,
  reactivateProject,
  requestProjectDeletion,
  cancelProjectDeletion,
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
    </div>
  );
}
