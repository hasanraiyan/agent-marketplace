"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  DatabaseIcon,
  FingerprintIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";




import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  deleteProjectStore,
  getProjectStores,
  listProjectStoreFiles,
  getProjectStoreFile,
  updateProjectStore,
  writeProjectStoreFile,
  deleteProjectStoreFile,
} from "@/lib/api/projects";

interface Store {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  scope?: string;
  accessMode?: string;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

// Lowercase letters, numbers, hyphens only (matches the backend schema
// /^[a-z0-9-]+$/); every other character collapses into a hyphen so the
// field stays valid as you type.
const sanitizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");

export default function EditStorePage() {
  const { projectId, storeId } = useParams<{ projectId: string; storeId: string }>();
  const router = useRouter();
  const [store, setStore] = React.useState<Store | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    scope: "domain",
    accessMode: "readwrite",
  });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [files, setFiles] = React.useState<{ path: string; content?: string; updatedAt?: string }[]>([]);
  const [filesLoading, setFilesLoading] = React.useState(false);
  const [filesError, setFilesError] = React.useState<string | null>(null);

  const [fileDialogOpen, setFileDialogOpen] = React.useState(false);
  const [filePath, setFilePath] = React.useState("");
  const [fileContent, setFileContent] = React.useState("");
  const [savingFile, setSavingFile] = React.useState(false);
  const [fileSaveError, setFileSaveError] = React.useState<string | null>(null);

  const [deleteFileTarget, setDeleteFileTarget] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingFile, setDeletingFile] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const storesHref = `/projects/${projectId}/stores`;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectStores(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Store[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((s) => (s.id ?? s._id) === storeId);
        if (!found) {
          setLoadError("Store not found.");
        } else {
          setStore(found);
          setFormData({
            name: found.name || "",
            description: found.description || "",
            scope: found.scope || "domain",
            accessMode: found.accessMode || "readwrite",
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load store."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setSaving(true);
    setSaveError(null);
    try {
      // scope is immutable after creation — never sent on update.
      const { name, description, accessMode } = formData;
      const targetId = store.id ?? store._id ?? storeId;
      await updateProjectStore(projectId, targetId, { name, description, accessMode });
      router.push(storesHref);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to update store."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!store) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = store.id ?? store._id ?? storeId;
      await deleteProjectStore(projectId, targetId);
      router.push(storesHref);
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete store."));
      setDeleting(false);
    }
  };

  const loadFiles = React.useCallback(async () => {
    if (storeId === "new") return;
    setFilesLoading(true);
    setFilesError(null);
    try {
      const res = await listProjectStoreFiles(projectId, storeId);
      const list = res.data?.data?.files ?? res.data?.files ?? [];
      setFiles(list);
    } catch (err) {
      setFilesError(errorMessage(err, "Failed to load files."));
    } finally {
      setFilesLoading(false);
    }
  }, [projectId, storeId]);

  React.useEffect(() => {
    if (storeId !== "new") void loadFiles();
  }, [storeId, loadFiles]);

  const openNewFileDialog = () => {
    setFilePath("");
    setFileContent("");
    setFileSaveError(null);
    setFileDialogOpen(true);
  };

  const openEditFileDialog = async (path: string) => {
    setFilePath(path);
    setFileContent("");
    setFileSaveError(null);
    setFileDialogOpen(true);
    try {
      const res = await getProjectStoreFile(projectId, storeId, path);
      setFileContent(res.data?.data?.content ?? res.data?.content ?? "");
    } catch (err) {
      setFileSaveError(errorMessage(err, "Failed to load file."));
    }
  };

  const handleSaveFile = async () => {
    if (!filePath.trim()) {
      setFileSaveError("Path is required.");
      return;
    }
    setSavingFile(true);
    setFileSaveError(null);
    try {
      await writeProjectStoreFile(projectId, storeId, {
        path: filePath.trim(),
        content: fileContent,
      });
      setFileDialogOpen(false);
      await loadFiles();
    } catch (err) {
      setFileSaveError(errorMessage(err, "Failed to save file."));
    } finally {
      setSavingFile(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteFileTarget) return;
    setDeletingFile(true);
    try {
      await deleteProjectStoreFile(projectId, storeId, deleteFileTarget);
      setDeleteFileTarget(null);
      await loadFiles();
    } catch (err) {
      setFilesError(errorMessage(err, "Failed to delete file."));
      setDeleteFileTarget(null);
    } finally {
      setDeletingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      </div>
    );
  }


  if (loadError || !store) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={storesHref} />}>Stores</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Store not found</CardTitle>
            <CardDescription>{loadError ?? "This store does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={storesHref} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to stores
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={storesHref} />}>Stores</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{store.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <DatabaseIcon />
          </span>
          Edit store
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Update the name, description or access mode. Scope cannot be changed after creation.
        </p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Store Configuration</CardTitle>
            <CardDescription>
              Content is populated separately via the API — this form only manages the Store&apos;s config.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: sanitizeName(e.target.value) }))}
                    required
                    minLength={2}
                    maxLength={64}
                  />
                  <FieldDescription>
                    Lowercase letters, numbers, and hyphens only. Mounted at{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      /stores/{formData.name || "&lt;name&gt;"}/
                    </code>{" "}
                    in every Agent it&apos;s assigned to.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What does this Store hold, and why would an Agent read it?"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    maxLength={1024}
                    rows={2}
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="scope">Scope</FieldLabel>
                    <Select
                      value={formData.scope}
                      onValueChange={(value: string | null) =>
                        setFormData((prev) => ({ ...prev, scope: value ?? "domain" }))
                      }
                      disabled
                      required
                    >
                      <SelectTrigger id="scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domain">Domain</SelectItem>
                        <SelectItem value="externalUser">Per user (separated)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>Cannot be changed after creation.</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="accessMode">Access mode</FieldLabel>
                    <Select
                      value={formData.accessMode}
                      onValueChange={(value: string | null) =>
                        setFormData((prev) => ({ ...prev, accessMode: value ?? "readwrite" }))
                      }
                      required
                    >
                      <SelectTrigger id="accessMode">
                        <SelectValue placeholder="Select an access mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="readwrite">Read-write — Agents can also write to it</SelectItem>
                        <SelectItem value="readonly">Read-only — Agents can only read; edit content here</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Read-only stores are safe to assign to Agents serving many different founders.
                    </FieldDescription>
                  </Field>
                </div>
              </FieldGroup>

              {saveError && <FieldError>{saveError}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={storesHref} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(storesHref)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Update store"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

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
                  <DatabaseIcon className="size-3.5" />
                  ID
                </span>
                <span className="max-w-[180px] truncate font-mono text-[11px]">
                  {store.id ?? store._id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-muted-foreground">Scope</span>
                <Badge variant="outline" className="capitalize">{formData.scope}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-muted-foreground">Access</span>
                <Badge variant="outline" className="capitalize">{formData.accessMode}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono text-[11px]">
                  {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <InfoIcon />
            <AlertTitle>Mount path</AlertTitle>
            <AlertDescription>
              Agents see this store at{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                /stores/{store.name}/
              </code>
              . Deleting it unmounts it from every Agent and purges its files.
            </AlertDescription>
          </Alert>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon />
                Danger zone
              </CardTitle>
              <CardDescription>
                Deleting unmounts this store from every Agent using it and purges all of its files.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <WarningCircleIcon className="size-3.5" />
                  {deleteError}
                </p>
              )}
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white" onClick={() => setDeleteOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete store
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              Content stored in this Store. Add, edit, or remove files (text/markdown).
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openNewFileDialog}>
            <PlusIcon data-icon="inline-start" />
            Add file
          </Button>
        </CardHeader>
        <CardContent>
          {filesError && (
            <p className="mb-3 text-xs text-destructive">{filesError}</p>
          )}
          {filesLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.path}>
                    <TableCell className="font-mono text-xs">{f.path}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openEditFileDialog(f.path)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteFileTarget(f.path)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{filePath && files.some((f) => f.path === filePath) ? "Edit file" : "Add file"}</DialogTitle>
            <DialogDescription>
              Path (e.g. /notes/intro.md) and content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/file.md"
              disabled={savingFile}
            />
            <Textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              rows={10}
              disabled={savingFile}
            />
            {fileSaveError && (
              <p className="text-xs text-destructive">{fileSaveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFileDialogOpen(false)}
              disabled={savingFile}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveFile()} disabled={savingFile}>
              {savingFile ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFileTarget} onOpenChange={(open) => !open && setDeleteFileTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFileTarget} will be permanently removed from this Store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFile}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFile();
              }}
              disabled={deletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFile ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete store “{store.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This unmounts the store from every Agent using it and permanently deletes all of its
              files. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
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