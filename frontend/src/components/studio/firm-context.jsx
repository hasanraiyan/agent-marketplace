"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { getMyFirm } from "@/lib/api/firms";

const FirmContext = createContext(null);

/**
 * Loads the creator's firm once for every /studio/firm/* screen.
 *
 * `notFound` is the "no firm yet" state (backend 404) — the overview page
 * turns it into the create hero, sub-pages turn it into a pointer back there.
 */
export function FirmProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await getMyFirm();
      setFirm(res.data?.data || null);
      setNotFound(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setFirm(null);
        setNotFound(true);
      } else {
        toast.error(err.response?.data?.message || "Failed to load your firm");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const value = useMemo(
    () => ({ firm, setFirm, loading, notFound, refresh }),
    [firm, loading, notFound, refresh],
  );

  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>;
}

export function useFirm() {
  const ctx = useContext(FirmContext);
  if (!ctx) throw new Error("useFirm must be used inside <FirmProvider>");
  return ctx;
}
