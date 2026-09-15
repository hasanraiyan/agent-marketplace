"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaSkillInput,
  PersonaBulkDeleteResult,
  PersonaPagination,
  PersonaSkill,
  PersonaSkillUsage,
  UpdatePersonaSkillInput,
  UseSkillsOptions,
} from "../types.js";

/**
 * CRUD for Skills — a reusable instruction + optional file bundle an Agent
 * can be given. Requires the host's `createPersonaHandler`/`createRuntime`
 * to opt in with `capabilities: { skills: true }`; every route this hook
 * calls 404s/is unreachable otherwise (skill authoring is Project-level
 * content management the host must deliberately turn on, not something a
 * chat session gets by default).
 *
 * Ownership follows the same self-serve model as `useAgents`/`useWorkflows`:
 * pass `scope: 'mine'` to restrict `skills` to the asserted external user's
 * own Skills (only meaningful when `PersonaProvider` is wired through an
 * adapter that resolves a real end-user identity) — omit it to see every
 * Skill visible to this Project (its own, plus public ones).
 */
export function useSkills(options: UseSkillsOptions = {}) {
  const { autoFetch = true, page, limit, search, scope } = options;

  const { fetchWithAuth } = usePersonaContext();
  const [skills, setSkills] = useState<PersonaSkill[]>([]);
  const [pagination, setPagination] = useState<PersonaPagination>({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (scope) query.set("scope", scope);

      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/skills${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list skills: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaSkill[] = Array.isArray(data) ? data : (data?.items ?? []);
      setSkills(items);
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

  const getSkill = useCallback(
    async (skillId: string): Promise<PersonaSkill> => {
      const res = await fetchWithAuth(`/skills/${skillId}`);
      if (!res.ok) throw new Error(`Failed to fetch skill: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const createSkill = useCallback(
    async (input: CreatePersonaSkillInput): Promise<PersonaSkill> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create skill (${res.status}): ${errText}`);
        }
        const created: PersonaSkill = await res.json();
        setSkills((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const updateSkill = useCallback(
    async (skillId: string, input: UpdatePersonaSkillInput): Promise<PersonaSkill> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update skill (${res.status}): ${errText}`);
        }
        const updated: PersonaSkill = await res.json();
        setSkills((prev) => prev.map((s) => (s._id === skillId ? updated : s)));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const deleteSkill = useCallback(
    async (skillId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/skills/${skillId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete skill (${res.status}): ${errText}`);
        }
        setSkills((prev) => prev.filter((s) => s._id !== skillId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const bulkDeleteSkills = useCallback(
    async (ids: string[]): Promise<PersonaBulkDeleteResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/skills/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete skills (${res.status}): ${errText}`);
        }
        const result: PersonaBulkDeleteResult = await res.json();
        const deletedSet = new Set(result.deleted);
        setSkills((prev) => prev.filter((s) => !deletedSet.has(s._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const getSkillUsage = useCallback(
    async (skillId: string): Promise<PersonaSkillUsage> => {
      const res = await fetchWithAuth(`/skills/${skillId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch skill usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  useEffect(() => {
    if (autoFetch) void fetchSkills();
  }, [autoFetch, fetchSkills]);

  return {
    skills,
    pagination,
    isLoading,
    error,
    refetch: fetchSkills,
    getSkill,
    createSkill,
    updateSkill,
    deleteSkill,
    bulkDeleteSkills,
    getSkillUsage,
  };
}
