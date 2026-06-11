"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMySkills, getPublicSkills } from "@/lib/api/skills";
import { toast } from "sonner";

const SkillsContext = createContext();

export function SkillsProvider({ children }) {
  const [mySkills, setMySkills] = useState([]);
  const [publicSkills, setPublicSkills] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <SkillsContext.Provider value={{ mySkills, publicSkills, loading, refreshSkills: fetchSkills }}>
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
