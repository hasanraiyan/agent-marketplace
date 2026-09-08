"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockIcon,
  CopyIcon,
  EyeIcon,
  EyeSlashIcon,
  FingerprintIcon,
  LockKeyIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
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
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getProjectSecrets(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Secret[] = res.data?.data ?? res.data?.data?.items ?? [];
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

    getProjectSecretUsage(projectId, secretId)
      .then((res) => {
        if (!cancelled) setUsage(res.data?.data ?? null);
      })
      .catch(() => {});

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
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !secret) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/secrets`} />}>Secrets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Secret not found</CardTitle>
            <CardDescription>{loadError ?? "This secret does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/secrets`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to secrets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.restApiToolCount ?? 0) > 0;
  const secretIdDisplay = secret.id ?? secret._id ?? secretId;

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/secrets`} />}>Secrets</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{secret.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <LockKeyIcon />
          </span>
          Edit secret
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Rename the label or rotate the value. Leave value blank to keep the current one. Values are never displayed — only the label is visible in the list.
        </p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        {/* Left column — form */}
        <Card>
          <CardHeader>
            <CardTitle>Secret details</CardTitle>
            <CardDescription>Label is unique per project. Value rotates the encrypted secret.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <FieldGroup>
                <Field data-invalid={!!saveError && !label.trim()}>
                  <FieldLabel htmlFor="secret-label">Label</FieldLabel>
                  <InputGroup data-invalid={!!saveError && !label.trim()}>
                    <InputGroupInput
                      id="secret-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      maxLength={100}
                      required
                      aria-invalid={!!saveError && !label.trim()}
                      placeholder={secret.label}
                    />
                  </InputGroup>
                  <FieldDescription>1–100 characters, unique per project.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="secret-value">Rotate value — optional</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="secret-value"
                      type={showValue ? "text" : "password"}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Leave blank to keep current value"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowValue((v) => !v)}
                        aria-label={showValue ? "Hide value" : "Show value"}
                      >
                        {showValue ? <EyeSlashIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>Enter a new value only if you want to rotate. It will be re-encrypted with AES-256-GCM.</FieldDescription>
                </Field>
              </FieldGroup>

              {saveError && <FieldError>{saveError}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/secrets`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/secrets`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right column — metadata + danger zone (stacks below on mobile) */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FingerprintIcon className="size-4 text-muted-foreground" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 divide-y divide-border text-xs">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FingerprintIcon className="size-3.5" />
                  ID
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="max-w-[140px] truncate font-mono text-[11px] sm:max-w-[180px]">{secretIdDisplay}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(secretIdDisplay);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <CopyIcon data-icon="inline-start" className={copied ? "text-primary" : undefined} />
                  </Button>
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Created
                </span>
                <span className="font-mono text-[11px]">{secret.createdAt ? new Date(secret.createdAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Last used</span>
                {secret.lastUsedAt ? (
                  <span className="font-mono text-[11px]">{new Date(secret.lastUsedAt).toLocaleString()}</span>
                ) : (
                  <Badge variant="outline">Never</Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary">Has value</Badge>
              </div>
            </CardContent>
          </Card>

          {isUsed && usage && (
            <Alert>
              <WarningCircleIcon />
              <AlertTitle>Used by {usage.restApiToolCount} REST tool(s)</AlertTitle>
              <AlertDescription>
                {usage.restApiTools.map((t) => t.name).join(", ")}. Remove it from those tools before deleting.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon />
                Danger zone
              </CardTitle>
              <CardDescription>Deleting is blocked while any REST tool still references this secret.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && <FieldError>{deleteError}</FieldError>}
              <Button
                variant="destructive"
                size="sm"
                className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                onClick={() => setDeleteOpen(true)}
              >
                <TrashIcon data-icon="inline-start" />
                Delete secret
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
