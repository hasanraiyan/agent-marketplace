"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  Upload,
  Search,
} from "lucide-react";
import {
  getProjectKnowledge,
  updateProjectKnowledge,
  deleteProjectKnowledge,
  getProjectKnowledgeDocuments,
  uploadProjectKnowledgeDocuments,
  deleteProjectKnowledgeDocument,
  searchProjectKnowledge,
} from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function ProjectKnowledgeDetailPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const kbId = params.kbId;
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [kb, setKb] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const [deleteKbOpen, setDeleteKbOpen] = useState(false);
  const [deletingKb, setDeletingKb] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);

  useDashboardHeader({
    title: kb?.name || "Knowledge Base",
    description: "Manage this Knowledge Base's metadata and documents.",
    actions: (
      <div className="flex items-center gap-3">
        <Link
          href={developerRoutes.project(projectId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        {kb ? <Badge variant="outline">{kb.embeddingModel}</Badge> : null}
      </div>
    ),
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getProjectKnowledge(projectId);
        const list = res.data?.data || [];
        const found = list.find((k) => (k._id || k.id) === kbId);
        if (found) {
          setKb(found);
        } else {
          toast.error("Knowledge Base not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load Knowledge Base.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, kbId, router]);

  const refreshDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const res = await getProjectKnowledgeDocuments(projectId, kbId);
      setDocuments(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load documents.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, kbId]);

  const openEdit = () => {
    setEditForm({ name: kb.name || "", description: kb.description || "" });
    setEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProjectKnowledge(projectId, kbId, editForm);
      setKb(res.data.data);
      toast.success("Knowledge Base updated.");
      setEditing(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update Knowledge Base.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKb = async () => {
    setDeletingKb(true);
    try {
      await deleteProjectKnowledge(projectId, kbId);
      toast.success("Knowledge Base deleted.");
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to delete Knowledge Base.",
      );
      setDeletingKb(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchProjectKnowledge(
        projectId,
        kbId,
        searchQuery.trim(),
      );
      setSearchResults(res.data?.data || []);
    } catch (err) {
      setSearchResults(null);
      setSearchError(
        err.response?.data?.message || "Search failed. Try again.",
      );
    } finally {
      setSearching(false);
    }
  };

  const handleFileSelect = (e) => {
    setPendingFiles(Array.from(e.target.files || []));
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      await uploadProjectKnowledgeDocuments(projectId, kbId, pendingFiles);
      toast.success(`${pendingFiles.length} file(s) uploaded.`);
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload files.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocTarget) return;
    setDeletingDoc(true);
    try {
      await deleteProjectKnowledgeDocument(
        projectId,
        kbId,
        deleteDocTarget.fileName,
      );
      toast.success("Document deleted.");
      setDeleteDocTarget(null);
      await refreshDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete document.");
    } finally {
      setDeletingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kb) return null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Knowledge Base Details</CardTitle>
            <CardDescription>
              Provider, embedding model, and chunk settings are fixed at
              creation.
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteKbOpen(true)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  maxLength={200}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  maxLength={1000}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="shadow-sm">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Description</span>
                <p className="whitespace-pre-wrap">{kb.description || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Chunk settings</span>
                <p>
                  Size {kb.chunkSize || "default"} · Overlap{" "}
                  {kb.chunkOverlap || "default"} · Top K {kb.topK || "default"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Test Retrieval</CardTitle>
          <CardDescription>
            Run a search the way an Agent would, to check what this Knowledge
            Base actually returns before wiring it up.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a question this Knowledge Base should be able to answer…"
              className="flex-1"
            />
            <Button type="submit" disabled={!searchQuery.trim() || searching}>
              {searching ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 size-3.5" />
              )}
              Search
            </Button>
          </form>

          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}

          {searchResults &&
            (searchResults.length > 0 ? (
              <div className="flex flex-col gap-3">
                {searchResults.map((r, i) => (
                  <div key={i} className="rounded-md border p-3 text-sm">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.source}
                      </Badge>
                      {r.score != null && (
                        <span className="text-xs text-muted-foreground">
                          score {Number(r.score).toFixed(3)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No matching chunks found.
              </p>
            ))}
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Upload PDF, TXT, MD, CSV, or JSON files for this Project&apos;s
            Agents to search.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.json"
              onChange={handleFileSelect}
              className="max-w-sm text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <Button
              onClick={handleUpload}
              disabled={pendingFiles.length === 0 || uploading}
              className="shadow-sm"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 size-3.5" />
              )}
              Upload {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ""}
            </Button>
          </div>

          {documentsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead className="hidden md:table-cell">Chunks</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Uploaded
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.fileName}>
                    <TableCell className="font-medium">
                      {doc.fileName}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatBytes(doc.fileSize)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {doc.chunkCount ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {doc.uploadedAt
                        ? new Date(doc.uploadedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDocTarget(doc)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete document */}
      <AlertDialog
        open={!!deleteDocTarget}
        onOpenChange={(open) => !open && setDeleteDocTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDocTarget?.fileName} and its indexed chunks will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteDocument();
              }}
              disabled={deletingDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDoc ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete knowledge base */}
      <AlertDialog open={deleteKbOpen} onOpenChange={setDeleteKbOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Knowledge Base?</AlertDialogTitle>
            <AlertDialogDescription>
              {kb.name} and all of its uploaded documents will be permanently
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingKb}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteKb();
              }}
              disabled={deletingKb}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingKb ? (
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
