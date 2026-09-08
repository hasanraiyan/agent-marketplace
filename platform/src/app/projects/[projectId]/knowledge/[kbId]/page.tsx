"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  FingerprintIcon,
  ClockIcon,
  TrashIcon,
  WarningCircleIcon,
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  FileTextIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  getProjectKnowledge,
  updateProjectKnowledge,
  deleteProjectKnowledge,
  getProjectKnowledgeDocuments,
  uploadProjectKnowledgeDocuments,
  deleteProjectKnowledgeDocument,
  getProjectKnowledgeUsage,
  searchProjectKnowledge,
} from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface KnowledgeBase {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  chunkCount?: number;
  embeddingModel?: string;
  providerId?: string | { _id: string; label: string };
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Doc {
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  chunkCount?: number;
  uploadedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function formatBytes(bytes?: number) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeDetailPage() {
  const { projectId, kbId } = useParams<{ projectId: string; kbId: string }>();
  const router = useRouter();

  const [kb, setKb] = React.useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({ name: "", description: "" });
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [documents, setDocuments] = React.useState<Doc[] | null>(null);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = React.useState<Doc | null>(null);
  const [deletingDoc, setDeletingDoc] = React.useState(false);

  const [usage, setUsage] = React.useState<{ agentCount: number; agents: { _id: string; name: string }[] } | null>(null);
  const [deleteKbOpen, setDeleteKbOpen] = React.useState(false);
  const [deletingKb, setDeletingKb] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<{ text: string; source: string; score: number }[] | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refreshKb = React.useCallback(async () => {
    const res = await getProjectKnowledge(projectId);
    const list: KnowledgeBase[] = res.data?.data ?? res.data?.data?.items ?? [];
    const found = list.find((k) => (k.id ?? k._id) === kbId || k._id === kbId);
    if (!found) throw new Error("Knowledge base not found");
    setKb(found);
    setEditForm({ name: found.name || "", description: found.description || "" });
    return found;
  }, [projectId, kbId]);

  const refreshDocuments = React.useCallback(async () => {
    const res = await getProjectKnowledgeDocuments(projectId, kbId);
    setDocuments(res.data?.data ?? []);
  }, [projectId, kbId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      refreshKb().catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load knowledge base."));
      }),
      refreshDocuments().catch(() => {}),
      getProjectKnowledgeUsage(projectId, kbId)
        .then((r) => {
          if (!cancelled) setUsage(r.data?.data ?? null);
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKb, refreshDocuments, projectId, kbId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const res = await updateProjectKnowledge(projectId, kbId, { name: editForm.name.trim(), description: editForm.description.trim() });
      const updated = res.data?.data as KnowledgeBase;
      setKb(updated ?? { ...kb!, name: editForm.name.trim(), description: editForm.description.trim() });
      deleteCachedByPrefix(cacheKey.resource(projectId, "knowledge"));
      setEditing(false);
    } catch (err) {
      setEditError(errorMessage(err, "Failed to update knowledge base."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKb = async () => {
    setDeletingKb(true);
    try {
      await deleteProjectKnowledge(projectId, kbId);
      deleteCachedByPrefix(cacheKey.resource(projectId, "knowledge"));
      router.push(`/projects/${projectId}/knowledge`);
    } catch (err) {
      setEditError(errorMessage(err, "Failed to delete knowledge base."));
      setDeletingKb(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingFiles(Array.from(e.target.files || []));
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadProjectKnowledgeDocuments(projectId, kbId, pendingFiles);
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments();
      await refreshKb();
      deleteCachedByPrefix(cacheKey.resource(projectId, "knowledge"));
    } catch (err) {
      setUploadError(errorMessage(err, "Failed to upload documents. Check file type (PDF, TXT, MD, CSV, JSON) and size (20MB max)."));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocTarget) return;
    setDeletingDoc(true);
    try {
      await deleteProjectKnowledgeDocument(projectId, kbId, deleteDocTarget.fileName);
      setDeleteDocTarget(null);
      await refreshDocuments();
      await refreshKb();
    } catch (err) {
      setUploadError(errorMessage(err, "Failed to delete document."));
    } finally {
      setDeletingDoc(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await searchProjectKnowledge(projectId, kbId, searchQuery.trim());
      setSearchResults(res.data?.data ?? []);
    } catch (err) {
      setSearchError(errorMessage(err, "Search failed."));
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !kb) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/knowledge`} />}>Knowledge</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Knowledge base not found</CardTitle>
            <CardDescription>{loadError ?? "This knowledge base does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/knowledge`} />}>
              Back to knowledge
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.agentCount ?? 0) > 0;
  const providerLabel = typeof kb.providerId === "object" ? (kb.providerId as { label: string })?.label : null;

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/knowledge`} />}>Knowledge</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{kb.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <BookOpenIcon />
          </span>
          <span className="truncate">{kb.name}</span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {kb.embeddingModel || "text-embedding-3-small"}
          </Badge>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">{kb.description || "No description"}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileTextIcon className="size-3.5" />
            {kb.documentCount ?? 0} docs · {kb.chunkCount ?? 0} chunks
          </span>
          <span>·</span>
          <span>Chunk {kb.chunkSize ?? 800} / Overlap {kb.chunkOverlap ?? 100} / TopK {kb.topK ?? 5}</span>
          {providerLabel && (
            <>
              <span>·</span>
              <span>Provider {providerLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <div className="flex flex-col gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base">Details</CardTitle>
                <CardDescription className="text-xs">Provider and chunk settings are fixed at creation.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            </CardHeader>
            <CardContent>
              {editing ? (
                <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                      <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required maxLength={200} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                      <Textarea id="edit-description" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} maxLength={1000} rows={3} />
                    </Field>
                  </FieldGroup>
                  {editError && <FieldError>{editError}</FieldError>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <span className="font-medium">{kb.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Description</span>
                    <p className="whitespace-pre-wrap text-sm">{kb.description || "—"}</p>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4 py-1 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ClockIcon className="size-3.5" />
                      Created
                    </span>
                    <span className="font-mono text-[11px]">{kb.createdAt ? new Date(kb.createdAt).toLocaleString() : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <FingerprintIcon className="size-3.5" />
                      ID
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="max-w-[140px] truncate font-mono text-[11px] sm:max-w-[180px]">{kb.id ?? kb._id}</span>
                      <Button variant="ghost" size="icon-xs" aria-label="Copy ID" onClick={() => navigator.clipboard.writeText(kb.id ?? kb._id ?? "")}>
                        <CopyIcon />
                      </Button>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UploadSimpleIcon className="size-4" />
                Documents
              </CardTitle>
              <CardDescription>PDF, TXT, MD, CSV, JSON — 20 MB each, 10 per batch. Stored in Qdrant.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.json" onChange={handleFileSelect} className="text-xs" />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-none border border-border bg-muted/20 px-3 py-2 text-xs">
                    {pendingFiles.map((f) => (
                      <span key={f.name} className="truncate">
                        {f.name} · {formatBytes(f.size)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpload} disabled={pendingFiles.length === 0 || uploading}>
                    {uploading ? "Uploading…" : `Upload ${pendingFiles.length ? `(${pendingFiles.length})` : ""}`}
                  </Button>
                  {pendingFiles.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setPendingFiles([])} disabled={uploading}>
                      Clear
                    </Button>
                  )}
                </div>
                {uploadError && <FieldError>{uploadError}</FieldError>}
              </div>

              <Separator />

              {documents === null ? (
                <Skeleton className="h-20 w-full" />
              ) : documents.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="hidden md:table-cell">Size</TableHead>
                        <TableHead className="hidden md:table-cell">Chunks</TableHead>
                        <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((d) => (
                        <TableRow key={d.fileName}>
                          <TableCell className="max-w-[200px] truncate font-mono text-xs">{d.fileName}</TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{formatBytes(d.fileSize)}</TableCell>
                          <TableCell className="hidden text-xs md:table-cell">{d.chunkCount ?? "—"}</TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                            {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-6 text-destructive hover:text-destructive" onClick={() => setDeleteDocTarget(d)}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MagnifyingGlassIcon className="size-4" />
                Test Retrieval
              </CardTitle>
              <CardDescription>Run a search the way an Agent would — query is embedded and matched against Qdrant.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input placeholder="Ask a question this Knowledge Base should be able to answer…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
                <Button type="submit" size="sm" disabled={searching || !searchQuery.trim()}>
                  {searching ? "Searching…" : "Search"}
                </Button>
              </form>
              {searchError && <FieldError>{searchError}</FieldError>}
              {searchResults !== null && (
                <div className="flex flex-col gap-3">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No matching chunks found.</p>
                  ) : (
                    searchResults.map((r, i) => (
                      <div key={i} className="flex flex-col gap-1 rounded-none border border-border bg-card px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="max-w-[160px] truncate font-mono text-[11px]">
                            {r.source}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">score {Number(r.score).toFixed(3)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">{r.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpenIcon className="size-4 text-muted-foreground" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {usage ? (
                usage.agentCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">Used by {usage.agentCount} agent(s):</p>
                    <ul className="flex list-disc flex-col gap-1 pl-4">
                      {usage.agents.map((a) => (
                        <li key={a._id} className="truncate">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not used by any agent.</p>
                )
              ) : (
                <p className="text-muted-foreground">Loading usage…</p>
              )}
            </CardContent>
          </Card>

          {isUsed && usage && (
            <Alert>
              <WarningCircleIcon />
              <AlertTitle>Used by {usage.agentCount} agent(s)</AlertTitle>
              <AlertDescription>{usage.agents.map((a) => a.name).join(", ")}.</AlertDescription>
            </Alert>
          )}

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon />
                Danger zone
              </CardTitle>
              <CardDescription>Deleting the knowledge base also deletes its Qdrant collection and all chunks.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white" onClick={() => setDeleteKbOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete knowledge base
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!deleteDocTarget} onOpenChange={(open) => !open && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDocTarget?.fileName} and its indexed chunks will be permanently removed from Qdrant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} disabled={deletingDoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingDoc ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteKbOpen} onOpenChange={setDeleteKbOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge base “{kb.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the knowledge base, its documents, and the Qdrant collection. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingKb}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKb} disabled={deletingKb} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingKb ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
