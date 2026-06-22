"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMySkills, getPublicSkills } from "@/lib/api/skills";
import { toast } from "sonner";

const SkillsContext = createContext();

const DEFAULT_MCPS = [];

export function SkillsProvider({ children }) {
  const [mySkills, setMySkills] = useState([]);
  const [publicSkills, setPublicSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Connectors / MCP state
  const [activeTab, setActiveTabState] = useState("skills");
  const [mcps, setMcps] = useState([]);
  const [selectedMcpId, setSelectedMcpId] = useState(null);
  const [isCreatingMcp, setIsCreatingMcp] = useState(false);

  const handleSetSelectedMcpId = useCallback((id) => {
    setSelectedMcpId(id);
    setIsCreatingMcp(false);
  }, []);

  // Sync tab with URL and localStorage
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

      // Load MCPs
      const savedMcps = localStorage.getItem("connectors_mcps");
      if (savedMcps) {
        try {
          const parsed = JSON.parse(savedMcps);
          const filtered = parsed.filter(m => !["github", "google-search", "filesystem", "postgres"].includes(m.id));
          setMcps(filtered);
          localStorage.setItem("connectors_mcps", JSON.stringify(filtered));
        } catch (e) {
          console.error("Failed to parse saved MCPs, resetting to empty");
          setMcps([]);
          localStorage.setItem("connectors_mcps", JSON.stringify([]));
        }
      } else {
        setMcps([]);
        localStorage.setItem("connectors_mcps", JSON.stringify([]));
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

  const saveMcps = useCallback((updatedMcps) => {
    setMcps(updatedMcps);
    if (typeof window !== "undefined") {
      localStorage.setItem("connectors_mcps", JSON.stringify(updatedMcps));
    }
  }, []);

  const addMcp = useCallback((newMcp) => {
    const mcpToAdd = {
      ...newMcp,
      id: newMcp.id || `custom-${Date.now()}`,
      status: newMcp.isEnabled ? "connected" : "disconnected",
      tools: newMcp.tools || [
        { name: `${newMcp.name.toLowerCase().replace(/\s+/g, "_")}_tool_1`, description: "Custom tool exported by server" }
      ]
    };
    saveMcps([...mcps, mcpToAdd]);
    toast.success(`MCP server "${newMcp.name}" added`);
    return mcpToAdd.id;
  }, [mcps, saveMcps]);

  const updateMcp = useCallback((id, updatedFields) => {
    const updated = mcps.map((m) => {
      if (m.id === id) {
        const isEnabledChanged = updatedFields.isEnabled !== undefined && updatedFields.isEnabled !== m.isEnabled;
        let newStatus = m.status;
        if (isEnabledChanged) {
          newStatus = updatedFields.isEnabled ? "connected" : "disconnected";
        }
        return {
          ...m,
          ...updatedFields,
          status: newStatus
        };
      }
      return m;
    });
    saveMcps(updated);
    toast.success("MCP configuration updated");
  }, [mcps, saveMcps]);

  const deleteMcp = useCallback((id) => {
    const updated = mcps.filter((m) => m.id !== id);
    saveMcps(updated);
    if (selectedMcpId === id) {
      setSelectedMcpId(null);
    }
    toast.success("MCP server deleted");
  }, [mcps, selectedMcpId, saveMcps]);

  const toggleMcp = useCallback((id) => {
    const updated = mcps.map((m) => {
      if (m.id === id) {
        const nextEnabled = !m.isEnabled;
        if (nextEnabled) {
          // Check if key credentials are filled
          const missingKeys = Object.entries(m.env || {}).filter(([_, val]) => !val).map(([k]) => k);
          if (missingKeys.length > 0) {
            toast.error(`Please configure required keys: ${missingKeys.join(", ")}`);
            return m;
          }
        }
        return {
          ...m,
          isEnabled: nextEnabled,
          status: nextEnabled ? "connected" : "disconnected"
        };
      }
      return m;
    });
    saveMcps(updated);
    const updatedMcp = updated.find(m => m.id === id);
    if (updatedMcp) {
      if (updatedMcp.isEnabled) {
        toast.success(`MCP server "${updatedMcp.name}" connected`);
      } else {
        toast.info(`MCP server "${updatedMcp.name}" disconnected`);
      }
    }
  }, [mcps, saveMcps]);

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
  }, [fetchSkills]);

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
        selectedMcpId,
        setSelectedMcpId: handleSetSelectedMcpId,
        isCreatingMcp,
        setIsCreatingMcp,
        addMcp,
        updateMcp,
        deleteMcp,
        toggleMcp
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
