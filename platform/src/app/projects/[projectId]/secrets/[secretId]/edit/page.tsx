"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  getProjectSecrets,
  updateProjectSecret,
  deleteProjectSecret,
  getProjectSecretUsage,
} from "@/lib/api/projects";

interface Secret {
  _id?: string;
  id: string;
  label: string;
  hasValue?: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  project?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
  );
}

export default function EditSecretPage() {
  const { projectId, secretId } = useParams<{ projectId: string; secretId: string }>();
  const router = useRouter();

  const [secret, setSecret] = React.useState<Secret | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [label, setLabel] = React.useState("");
  const [value, setValue] = React.useState("");
  const [showValue, setShowValue] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [usage, setUsage] = React.useState<{ restApiToolCount: number; restApiTools: { _id: string; name: string }[] } | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getProjectSecrets(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Secret[] = res.data?.data ?? res.data?.data?.items ?? [];
        // Backend returns {id,label} — handle both id and _id for robustness
        const found = list.find((s) => (s.id ?? s._id) === secretId || s._id === secretId || String(s.id) === String(secretId));
        if (!found) {
          setLoadError("Secret not found.");
          setSecret(null);
        } else {
          setSecret(found);
          setLabel(found.label);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load secret."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Preload usage for delete guard
    getProjectSecretUsage(projectId, secretId)
      .then((res) => {
        if (!cancelled) setUsage(res.data?.data ?? null);
      })
      .catch(() => {
        // Usage is non-critical; ignore if it fails (e.g. secretId malformed)
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, secretId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setSaveError("Label is required.");
      return;
    }
    if (trimmedLabel.length > 100) {
      setSaveError("Label must be 1–100 characters.");
      return;
    }
    const payload: Record<string, string> = {};
    if (trimmedLabel !== secret.label) payload.label = trimmedLabel;
    if (value) payload.value = value;
    if (Object.keys(payload).length === 0) {
      setSaveError("No changes to save. Change the label or enter a new value to rotate.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const targetId = secret.id ?? secret._id ?? secretId;
      await updateProjectSecret(projectId, targetId, payload);
      router.push(`/projects/${projectId}/secrets`);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to update secret. Label may already exist."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!secret) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = secret.id ?? secret._id ?? secretId;
      await deleteProjectSecret(projectId, targetId);
      router.push(`/projects/${projectId}/secrets`);
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete secret. It may still be used by REST tools."));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !secret) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/projects/${projectId}/secrets`} />}>
          <ArrowLeftIcon />
          Back to secrets
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Secret not found</CardTitle>
            <CardDescription>{loadError ?? "This secret does not exist."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.restApiToolCount ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/projects/${projectId}/secrets`} />}>
        <ArrowLeftIcon />
        Back to secrets
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyIcon className="size-4 text-muted-foreground" />
            Edit secret
          </CardTitle>
          <CardDescription>
            Rename the label or rotate the value. Leave value blank to keep the current one. Values
            are never displayed — only the label is visible in the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-1 rounded-none border border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-mono">{secret.createdAt ? new Date(secret.createdAt).toLocaleString() : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last used</span>
              <span className="font-mono">{secret.lastUsedAt ? new Date(secret.lastUsedAt).toLocaleString() : "Never"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-[10px]">{secret.id ?? secret._id}</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="secret-label">Label</FieldLabel>
              <Input
                id="secret-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
                required
              />
              <FieldDescription>Unique per project, 1–100 chars.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="secret-value">Rotate value (optional)</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="secret-value"
                  type={showValue ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Leave blank to keep current value"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowValue((v) => !v)}
                  aria-label={showValue ? "Hide value" : "Show value"}
                >
                  {showValue ? <EyeSlashIcon /> : <EyeIcon />}
                </Button>
              </div>
              <FieldDescription>Enter a new value only if you want to rotate. It will be re-encrypted.</FieldDescription>
            </Field>

            {saveError && <FieldError>{saveError}</FieldError>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/secrets`)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TrashIcon className="size-4" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Deleting a secret is blocked while any REST tool still references it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isUsed && usage && (
            <div className="flex gap-2 rounded-none border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <WarningIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                Used by {usage.restApiToolCount} REST tool(s): {usage.restApiTools.map((t) => t.name).join(", ")}. Remove it from
                those tools before deleting.
              </span>
            </div>
          )}
          {deleteError && <FieldError>{deleteError}</FieldError>}
          <Button variant="destructive" size="sm" className="w-fit" onClick={() => setDeleteOpen(true)}>
            <TrashIcon />
            Delete secret
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete secret “{secret.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The label will be permanently deleted.{" "}
              {isUsed ? "This is currently blocked while REST tools still reference it." : "Any REST tool using this secret will need to be updated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
