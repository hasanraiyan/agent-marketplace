"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMySkills, getPublicSkills } from "@/lib/api/skills";
import {
  getMyMcps,
  createMcp as createMcpApi,
  updateMcp as updateMcpApi,
  deleteMcp as deleteMcpApi,
} from "@/lib/api/mcps";
import { toast } from "sonner";

const SkillsContext = createContext();

export function SkillsProvider({ children }) {
  const [mySkills, setMySkills] = useState([]);
  const [publicSkills, setPublicSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Connectors / MCP state
  const [activeTab, setActiveTabState] = useState("skills");
  const [mcps, setMcps] = useState([]);
  const [loadingMcps, setLoadingMcps] = useState(true);
  const [selectedMcpId, setSelectedMcpId] = useState(null);
  const [isCreatingMcp, setIsCreatingMcp] = useState(false);

  const handleSetSelectedMcpId = useCallback((id) => {
    setSelectedMcpId(id);
    setIsCreatingMcp(false);
  }, []);

  // Sync the active connectors tab with the URL/localStorage (pure UI state,
  // no backend involved).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "mcps" || tab === "skills") {
        setActiveTabState(tab);
      } else {
        const savedTab = localStorage.getItem("connectors_active_tab");
        if (savedTab === "mcps" || savedTab === "skills") {
          setActiveTabState(savedTab);
        }
      }
    }
  }, []);

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("connectors_active_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  const fetchMcps = useCallback(async () => {
    try {
      const res = await getMyMcps();
      setMcps(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load MCP servers");
    } finally {
      setLoadingMcps(false);
    }
  }, []);

  const createMcp = useCallback(async (data) => {
    try {
      const res = await createMcpApi(data);
      const created = res.data?.data;
      setMcps((prev) => [created, ...prev]);
      toast.success(`MCP server "${created.name}" added`);
      return created;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add MCP server");
      throw err;
    }
  }, []);

  const updateMcp = useCallback(async (id, data) => {
    try {
      const res = await updateMcpApi(id, data);
      const updated = res.data?.data;
      setMcps((prev) => prev.map((m) => (m._id === id ? updated : m)));
      toast.success("MCP configuration updated");
      return updated;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update MCP server");
      throw err;
    }
  }, []);

  const deleteMcp = useCallback(
    async (id) => {
      try {
        await deleteMcpApi(id);
        setMcps((prev) => prev.filter((m) => m._id !== id));
        if (selectedMcpId === id) {
          setSelectedMcpId(null);
        }
        toast.success("MCP server deleted");
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete MCP server");
        throw err;
      }
    },
    [selectedMcpId]
  );

  const toggleMcp = useCallback(
    async (id) => {
      const current = mcps.find((m) => m._id === id);
      if (!current) return;
      await updateMcp(id, { isEnabled: !current.isEnabled });
    },
    [mcps, updateMcp]
  );

  const fetchSkills = useCallback(async () => {
    try {
      const [myRes, publicRes] = await Promise.all([
        getMySkills(),
        getPublicSkills(),
      ]);
      setMySkills(myRes.data?.data || []);
      setPublicSkills(publicRes.data?.data || []);
    } catch (err) {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    fetchMcps();
  }, [fetchSkills, fetchMcps]);

  return (
    <SkillsContext.Provider
      value={{
        mySkills,
        publicSkills,
        loading,
        refreshSkills: fetchSkills,
        activeTab,
        setActiveTab,
        mcps,
        loadingMcps,
        refreshMcps: fetchMcps,
        selectedMcpId,
        setSelectedMcpId: handleSetSelectedMcpId,
        isCreatingMcp,
        setIsCreatingMcp,
        createMcp,
        updateMcp,
        deleteMcp,
        toggleMcp,
      }}
    >
      {children}
    </SkillsContext.Provider>
  );
}

export function useSkills() {
  const context = useContext(SkillsContext);
  if (!context) {
    throw new Error("useSkills must be used within a SkillsProvider");
  }
  return context;
}
