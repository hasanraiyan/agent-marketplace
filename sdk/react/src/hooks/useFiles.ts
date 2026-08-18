'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';

export interface PersonaFileItem {
  _id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt: string;
}

export function useFiles(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState<PersonaFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/files');
      if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.files || data?.items || [];
      setFiles(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  const uploadFile = useCallback(
    async (fileOrFormData: FormData | { name: string; uri: string; type?: string }) => {
      setIsUploading(true);
      setError(null);
      try {
        let body: FormData;
        if (fileOrFormData instanceof FormData) {
          body = fileOrFormData;
        } else {
          // React Native FormData support
          body = new FormData();
          body.append('file', fileOrFormData as unknown as Blob);
        }

        const res = await fetchWithAuth('/files', {
          method: 'POST',
          body,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => 'Upload failed');
          throw new Error(`Upload error (${res.status}): ${errText}`);
        }

        const uploaded = (await res.json()) as PersonaFileItem;
        void fetchFiles();
        return uploaded;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsUploading(false);
      }
    },
    [fetchWithAuth, fetchFiles]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      const res = await fetchWithAuth(`/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      setFiles((prev) => prev.filter((f) => f._id !== fileId));
    },
    [fetchWithAuth]
  );

  const getDownloadUrl = useCallback(
    (fileId: string) => {
      return `/files/${fileId}`;
    },
    []
  );

  useEffect(() => {
    if (autoFetch) {
      void fetchFiles();
    }
  }, [autoFetch, fetchFiles]);

  return {
    files,
    isLoading,
    isUploading,
    error,
    refetch: fetchFiles,
    uploadFile,
    deleteFile,
    getDownloadUrl,
  };
}
