"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type { PersonaAttachment, PersonaMessageAttachment } from "../types.js";

/**
 * Image attachments for chat messages (the Agent needs `imageInputEnabled`).
 *
 * - `useAttachments()` — pick, check and upload images (through the runtime's
 *   `POST /files`), with instant previews; pass `ready` to
 *   `sendMessage(text, { attachments })`.
 * - `useAttachmentUrl(fileId)` — an `<img src>` for an attached image. The
 *   runtime's file download needs the auth header, so the image is fetched
 *   with it and shown through an object URL.
 *
 * The server re-checks everything (type from the bytes, size, count,
 * ownership); the checks here only give the user quick feedback.
 */

/** Same limits the server enforces (`IMAGE_ATTACHMENT_LIMITS` in @personaai/sdk). */
export const ATTACHMENT_LIMITS = Object.freeze({
  maxFiles: 4,
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif"]),
});

// ── shared image cache ──────────────────────────────────────────────────────
// Blobs by file id, so a just-uploaded image renders in the sent message
// without downloading it again, and history thumbnails aren't refetched on
// every mount. Bounded by total bytes (oldest dropped first).
const CACHE_MAX_BYTES = 40 * 1024 * 1024;
const blobCache = new Map<string, Blob>();
let cacheBytes = 0;

function cacheBlob(fileId: string, blob: Blob) {
  const existing = blobCache.get(fileId);
  if (existing) {
    blobCache.delete(fileId);
    cacheBytes -= existing.size;
  }
  if (blob.size > CACHE_MAX_BYTES) return;
  blobCache.set(fileId, blob);
  cacheBytes += blob.size;
  for (const [key, value] of blobCache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    blobCache.delete(key);
    cacheBytes -= value.size;
  }
}

function cachedBlob(fileId: string): Blob | undefined {
  const blob = blobCache.get(fileId);
  if (blob) {
    // Refresh recency.
    blobCache.delete(fileId);
    blobCache.set(fileId, blob);
  }
  return blob;
}

/** For tests. */
export function __clearAttachmentCache() {
  blobCache.clear();
  cacheBytes = 0;
}

// ── useAttachments ─────────────────────────────────────────────────────────

export interface UseAttachmentsOptions {
  /** @default 4 (the server's per-message limit) */
  maxFiles?: number;
  /** @default 5 MB (the server's limit) */
  maxBytes?: number;
  /** Optional context recorded on the uploaded file. */
  agentId?: string;
}

export interface UseAttachmentsResult {
  attachments: PersonaAttachment[];
  /** Uploaded and ready to send — pass to `sendMessage(text, { attachments: ready })`. */
  ready: PersonaMessageAttachment[];
  isUploading: boolean;
  /** The latest rejection (wrong type, too big, too many), cleared by the next add/remove/clear. */
  error: string | null;
  /** For `<input type="file" accept={accept}>`. */
  accept: string;
  /** Adds images (e.g. from a file input, paste or drop) and starts uploading them. */
  add: (files: FileList | File[] | null | undefined) => void;
  /** Removes one image (cancels its upload if still running). */
  remove: (id: string) => void;
  /** Removes all — call after sending. */
  clear: () => void;
}

let localSeq = 0;

export function useAttachments(options: UseAttachmentsOptions = {}): UseAttachmentsResult {
  const { fetchWithAuth, logger } = usePersonaContext();
  const log = useMemo(() => logger.child("attachments"), [logger]);
  const maxFiles = options.maxFiles ?? ATTACHMENT_LIMITS.maxFiles;
  const maxBytes = options.maxBytes ?? ATTACHMENT_LIMITS.maxBytes;
  const agentId = options.agentId;

  const [attachments, setAttachments] = useState<PersonaAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const controllers = useRef(new Map<string, AbortController>());

  const update = useCallback((id: string, patch: Partial<PersonaAttachment>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const upload = useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        if (agentId) form.append("agentId", agentId);
        const res = await fetchWithAuth("/files", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text ? `Upload failed (${res.status}): ${text.slice(0, 200)}` : `Upload failed (${res.status})`);
        }
        const body = await res.json();
        const data = (body?.data ?? body) as { id?: string; _id?: string };
        const fileId = data.id ?? data._id;
        if (!fileId) throw new Error("Upload returned no file id");
        cacheBlob(fileId, file);
        update(id, { status: "ready", fileId });
        log.debug("attachment uploaded", { fileId, size: file.size });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        log.warn("attachment upload failed", { error: message });
        update(id, { status: "error", error: message });
      } finally {
        controllers.current.delete(id);
      }
    },
    [agentId, fetchWithAuth, log, update],
  );

  const add = useCallback(
    (files: FileList | File[] | null | undefined) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      setError(null);

      const room = maxFiles - attachmentsRef.current.length;
      const rejected: string[] = [];
      const accepted: Array<{ entry: PersonaAttachment; file: File }> = [];
      for (const file of list) {
        if (!(ATTACHMENT_LIMITS.mimeTypes as readonly string[]).includes(file.type)) {
          rejected.push(`${file.name}: only PNG, JPEG, WebP or GIF images`);
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(`${file.name}: larger than ${Math.round(maxBytes / (1024 * 1024))} MB`);
          continue;
        }
        if (accepted.length >= room) {
          rejected.push(`At most ${maxFiles} images per message`);
          break;
        }
        accepted.push({
          file,
          entry: {
            id: `att-${Date.now()}-${++localSeq}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            previewUrl: URL.createObjectURL(file),
            status: "uploading",
          },
        });
      }

      if (rejected.length > 0) setError(rejected.join(". "));
      if (accepted.length === 0) return;
      setAttachments((prev) => [...prev, ...accepted.map((a) => a.entry)]);
      for (const { entry, file } of accepted) void upload(entry.id, file);
    },
    [maxBytes, maxFiles, upload],
  );

  const discard = useCallback((items: PersonaAttachment[]) => {
    for (const item of items) {
      controllers.current.get(item.id)?.abort();
      controllers.current.delete(item.id);
      URL.revokeObjectURL(item.previewUrl);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      setError(null);
      discard(attachmentsRef.current.filter((a) => a.id === id));
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [discard],
  );

  const clear = useCallback(() => {
    setError(null);
    discard(attachmentsRef.current);
    setAttachments([]);
  }, [discard]);

  // Release previews and cancel uploads on unmount.
  useEffect(() => () => discard(attachmentsRef.current), [discard]);

  const ready = useMemo<PersonaMessageAttachment[]>(
    () =>
      attachments
        .filter((a) => a.status === "ready" && a.fileId)
        .map((a) => ({ fileId: a.fileId as string, mimeType: a.mimeType, name: a.name })),
    [attachments],
  );

  return {
    attachments,
    ready,
    isUploading: attachments.some((a) => a.status === "uploading"),
    error,
    accept: ATTACHMENT_LIMITS.mimeTypes.join(","),
    add,
    remove,
    clear,
  };
}

// ── useAttachmentUrl ───────────────────────────────────────────────────────

export interface UseAttachmentUrlResult {
  /** Object URL for `<img src>`, or null while loading / on error. */
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

/** An `<img src>` for an attached image, fetched with the user's auth. */
export function useAttachmentUrl(fileId: string | null | undefined): UseAttachmentUrlResult {
  const { fetchWithAuth } = usePersonaContext();
  const [state, setState] = useState<UseAttachmentUrlResult>({ url: null, isLoading: !!fileId, error: null });

  useEffect(() => {
    if (!fileId) {
      setState({ url: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    const show = (blob: Blob) => {
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, isLoading: false, error: null });
    };

    const hit = cachedBlob(fileId);
    if (hit) {
      show(hit);
    } else {
      setState({ url: null, isLoading: true, error: null });
      const controller = new AbortController();
      (async () => {
        try {
          const res = await fetchWithAuth(`/files/${encodeURIComponent(fileId)}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`Image unavailable (${res.status})`);
          const blob = await res.blob();
          if (cancelled) return;
          cacheBlob(fileId, blob);
          show(blob);
        } catch (err) {
          if (cancelled) return;
          setState({ url: null, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      })();
      return () => {
        cancelled = true;
        controller.abort();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, fetchWithAuth]);

  return state;
}
