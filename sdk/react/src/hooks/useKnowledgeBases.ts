"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaKnowledgeBaseInput,
  PersonaBulkDeleteResult,
  PersonaDeleteDocumentResult,
  PersonaKnowledgeBase,
  PersonaKnowledgeBaseUsage,
  PersonaKnowledgeDocument,
  PersonaKnowledgeSearchResult,
  PersonaPagination,
  PersonaUploadDocumentsResult,
  UpdatePersonaKnowledgeBaseInput,
  UseKnowledgeBasesOptions,
} from "../types.js";

export interface UploadKnowledgeDocumentInput {
  filename: string;
  /** Browser `File`/`Blob`, or a React Native `{ uri, name, type }`-style asset. */
  content: Blob | { uri: string; name?: string; type?: string };
  contentType?: string;
}

/**
 * CRUD for Knowledge Bases — vector-search-backed document collections an
 * Agent can be given. Requires the host's `createPersonaHandler`/
 * `createRuntime` to opt in with `capabilities: { knowledge: true }`;
 * every route this hook calls 404s/is unreachable otherwise.
 *
 * Ownership follows the same self-serve model as `useSkills`/`useAgents`:
 * pass `scope: 'mine'` to restrict `knowledgeBases` to the asserted
 * external user's own Knowledge Bases — omit it to see every one visible
 * to this Project (its own, plus public ones).
 */
export function useKnowledgeBases(options: UseKnowledgeBasesOptions = {}) {
  const { autoFetch = true, page, limit, search, scope } = options;

  const { fetchWithAuth } = usePersonaContext();
  const [knowledgeBases, setKnowledgeBases] = useState<PersonaKnowledgeBase[]>([]);
  const [pagination, setPagination] = useState<PersonaPagination>({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (scope) query.set("scope", scope);

      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/knowledge${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list knowledge bases: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaKnowledgeBase[] = Array.isArray(data) ? data : (data?.items ?? []);
      setKnowledgeBases(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 },
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search, scope]);

  const getKnowledgeBase = useCallback(
    async (kbId: string): Promise<PersonaKnowledgeBase> => {
      const res = await fetchWithAuth(`/knowledge/${kbId}`);
      if (!res.ok) throw new Error(`Failed to fetch knowledge base: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const createKnowledgeBase = useCallback(
    async (input: CreatePersonaKnowledgeBaseInput): Promise<PersonaKnowledgeBase> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create knowledge base (${res.status}): ${errText}`);
        }
        const created: PersonaKnowledgeBase = await res.json();
        setKnowledgeBases((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const updateKnowledgeBase = useCallback(
    async (kbId: string, input: UpdatePersonaKnowledgeBaseInput): Promise<PersonaKnowledgeBase> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/knowledge/${kbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update knowledge base (${res.status}): ${errText}`);
        }
        const updated: PersonaKnowledgeBase = await res.json();
        setKnowledgeBases((prev) => prev.map((kb) => (kb._id === kbId ? updated : kb)));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const deleteKnowledgeBase = useCallback(
    async (kbId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/knowledge/${kbId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete knowledge base (${res.status}): ${errText}`);
        }
        setKnowledgeBases((prev) => prev.filter((kb) => kb._id !== kbId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const bulkDeleteKnowledgeBases = useCallback(
    async (ids: string[]): Promise<PersonaBulkDeleteResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/knowledge/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete knowledge bases (${res.status}): ${errText}`);
        }
        const result: PersonaBulkDeleteResult = await res.json();
        const deletedSet = new Set(result.deleted);
        setKnowledgeBases((prev) => prev.filter((kb) => !deletedSet.has(kb._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const getKnowledgeBaseUsage = useCallback(
    async (kbId: string): Promise<PersonaKnowledgeBaseUsage> => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch knowledge base usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const uploadDocuments = useCallback(
    async (kbId: string, files: UploadKnowledgeDocumentInput[]): Promise<PersonaUploadDocumentsResult> => {
      setIsUploading(true);
      setError(null);
      try {
        const body = new FormData();
        for (const file of files) {
          if (file.content instanceof Blob) {
            body.append("files", file.content, file.filename);
          } else {
            // React Native FormData support
            body.append("files", {
              uri: file.content.uri,
              name: file.content.name ?? file.filename,
              type: file.content.type ?? file.contentType,
            } as unknown as Blob);
          }
        }

        const res = await fetchWithAuth(`/knowledge/${kbId}/documents`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to upload documents (${res.status}): ${errText}`);
        }
        const result: PersonaUploadDocumentsResult = await res.json();
        setKnowledgeBases((prev) =>
          prev.map((kb) =>
            kb._id === kbId
              ? { ...kb, documentCount: result.documentCount, chunkCount: result.chunkCount }
              : kb,
          ),
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsUploading(false);
      }
    },
    [fetchWithAuth],
  );

  const listDocuments = useCallback(
    async (kbId: string): Promise<PersonaKnowledgeDocument[]> => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/documents`);
      if (!res.ok) throw new Error(`Failed to list documents: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const deleteDocument = useCallback(
    async (kbId: string, sourceName: string): Promise<PersonaDeleteDocumentResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth(
          `/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete document (${res.status}): ${errText}`);
        }
        const result: PersonaDeleteDocumentResult = await res.json();
        setKnowledgeBases((prev) =>
          prev.map((kb) =>
            kb._id === kbId
              ? { ...kb, documentCount: result.remainingDocuments, chunkCount: result.remainingChunks }
              : kb,
          ),
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const searchKnowledgeBase = useCallback(
    async (
      kbId: string,
      query: string,
      opts?: { topK?: number },
    ): Promise<PersonaKnowledgeSearchResult[]> => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: opts?.topK }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to search knowledge base (${res.status}): ${errText}`);
      }
      return res.json();
    },
    [fetchWithAuth],
  );

  useEffect(() => {
    if (autoFetch) void fetchKnowledgeBases();
  }, [autoFetch, fetchKnowledgeBases]);

  return {
    knowledgeBases,
    pagination,
    isLoading,
    isUploading,
    error,
    refetch: fetchKnowledgeBases,
    getKnowledgeBase,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    bulkDeleteKnowledgeBases,
    getKnowledgeBaseUsage,
    uploadDocuments,
    listDocuments,
    deleteDocument,
    search: searchKnowledgeBase,
  };
}
