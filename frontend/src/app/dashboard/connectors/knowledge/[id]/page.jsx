"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookText,
  Upload,
  FileText,
  Trash2,
  Loader2,
  File,
  X,
  CheckCircle2,
  ArrowLeft,
  Pencil,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getKnowledgeBase,
  getKnowledgeDocuments,
  deleteKnowledgeBase,
  deleteDocument,
  uploadFiles,
  updateKnowledgeBase,
} from "@/lib/api/knowledge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [kb, setKb] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);

  const fetchKb = useCallback(async () => {
    try {
      const res = await getKnowledgeBase(id);
      setKb(res.data?.data);
    } catch (err) {
      toast.error("Failed to load knowledge base");
      router.push("/dashboard/connectors/knowledge");
    }
  }, [id, router]);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await getKnowledgeDocuments(id);
      setDocuments(res.data?.data || []);
    } catch (err) {
      // Documents are optional
    }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchKb(), fetchDocs()]).finally(() => setLoading(false));
  }, [fetchKb, fetchDocs]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setFiles((prev) => [...prev, ...selected]);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }

    setUploading(true);
    setUploadProgress("Processing files...");

    try {
      const res = await uploadFiles(id, files);
      const result = res.data?.data;
      toast.success(
        `${result?.files?.length || files.length} file(s) uploaded successfully`
      );
      setFiles([]);
      await Promise.all([fetchKb(), fetchDocs()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload files");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const startEditing = () => {
    setEditName(kb.name || "");
    setEditDescription(kb.description || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditName("");
    setEditDescription("");
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await updateKnowledgeBase(id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setKb(res.data?.data);
      setEditing(false);
      toast.success("Knowledge base updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteDocument = async (sourceName) => {
    if (
      !confirm(
        `Delete "${sourceName}"? This will permanently remove its ${documents.find((d) => d.fileName === sourceName)?.chunkCount || 0} chunks from the knowledge base.`
      )
    ) {
      return;
    }

    setDeletingDoc(sourceName);
    try {
      await deleteDocument(id, sourceName);
      toast.success(`"${sourceName}" deleted`);
      await Promise.all([fetchKb(), fetchDocs()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete document");
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this knowledge base? This will permanently remove all uploaded documents.")) {
      return;
    }

    setDeleting(true);
    try {
      await deleteKnowledgeBase(id);
      toast.success("Knowledge base deleted");
      router.push("/dashboard/connectors/knowledge");
    } catch (err) {
      toast.error("Failed to delete knowledge base");
      setDeleting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const validFiles = droppedFiles.filter((f) => {
      const name = f.name.toLowerCase();
      return (
        name.endsWith(".pdf") ||
        name.endsWith(".txt") ||
        name.endsWith(".md") ||
        name.endsWith(".json") ||
        name.endsWith(".csv")
      );
    });
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
    if (validFiles.length !== droppedFiles.length) {
      toast.warning("Some files were skipped. Supported: PDF, TXT, MD, JSON, CSV");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!kb) return null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back button */}
      <div className="px-6 pt-4 pb-2">
        <Link
          href="/dashboard/connectors/knowledge"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Knowledge Bases
        </Link>
      </div>

      <div className="flex-1 px-6 pb-8 space-y-6">
        {/* Header Card */}
        <div className="rounded-3xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <BookText className="size-7" />
              </div>

              {editing ? (
                <div className="flex-1 space-y-3 min-w-0">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Knowledge base name"
                    className="h-10 text-lg font-bold bg-muted/20"
                    autoFocus
                  />
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={2}
                    className="bg-muted/20 resize-none text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={savingEdit || !editName.trim()}
                      className="rounded-full font-bold"
                    >
                      {savingEdit ? (
                        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5 mr-1.5" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditing}
                      disabled={savingEdit}
                      className="rounded-full"
                    >
                      <X className="size-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 group/edit">
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {kb.name}
                    </h1>
                    <button
                      onClick={startEditing}
                      className="shrink-0 opacity-0 group-hover/edit:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label="Edit name and description"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {kb.description || "No description"}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant="secondary" className="rounded-full text-xs font-bold px-3">
                      {kb.documentCount || 0} documents
                    </Badge>
                    <Badge variant="secondary" className="rounded-full text-xs font-bold px-3">
                      {kb.chunkCount || 0} chunks
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Settings:</span>
                    <Badge variant="outline" className="rounded-full text-[11px] font-medium px-2 py-0.5 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Model: {kb.embeddingModel || "text-embedding-3-small"}
                    </Badge>
                    {kb.providerId?.label && (
                      <Badge variant="outline" className="rounded-full text-[11px] font-medium px-2 py-0.5 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                        Provider: {kb.providerId.label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="rounded-full text-[11px] font-medium px-2 py-0.5 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Chunk: {kb.chunkSize || 800} (overlap {kb.chunkOverlap ?? 100})
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[11px] font-medium px-2 py-0.5 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Top K: {kb.topK || 5}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {!editing && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  className="rounded-full"
                >
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        <div className="rounded-3xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-6">
          <div className="flex items-center gap-2 border-b pb-2 mb-4 text-foreground/80">
            <Upload className="size-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Upload Documents
            </h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver
                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5"
                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="size-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-600">
              <Upload className="size-6" />
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              PDF, TXT, MD, JSON, CSV — up to 20MB per file
            </p>
            <label className="inline-flex cursor-pointer">
              <span className="inline-flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-transparent px-5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors select-none">
                <FileText className="size-4 mr-1.5" />
                Choose Files
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.json,.csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {files.length} file(s) selected
              </p>
              <div className="grid gap-2">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-150/60 dark:border-zinc-900/60 bg-zinc-50/50 dark:bg-zinc-900/10 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <File className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      disabled={uploading}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="w-full mt-3 rounded-full font-bold shadow-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {uploadProgress || "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-2" />
                    Upload & Process {files.length} file(s)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="rounded-3xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-6">
          <div className="flex items-center gap-2 border-b pb-2 mb-4 text-foreground/80">
            <FileText className="size-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Documents
            </h2>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {documents.length}
            </Badge>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3 text-zinc-400">
                <FileText className="size-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No documents uploaded yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload PDF, TXT, or MD files above to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {documents.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-zinc-150/60 dark:border-zinc-900/60 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <File className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>
                          {doc.fileSize
                            ? `${(doc.fileSize / 1024).toFixed(0)} KB`
                            : "—"}
                        </span>
                        <span>{doc.chunkCount || 0} chunks</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <button
                      onClick={() => handleDeleteDocument(doc.fileName)}
                      disabled={deletingDoc === doc.fileName}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                      title={`Delete ${doc.fileName}`}
                    >
                      {deletingDoc === doc.fileName ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
