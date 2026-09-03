"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyFirmTeam } from "@/lib/api/firms";

/**
 * The creator's agents annotated with firm membership (`isMember`,
 * `isFrontDesk`, `role`). Shared by the overview, project form, and team page.
 */
export function useFirmTeam({ enabled = true } = {}) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getMyFirmTeam();
      setTeam(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load your agents");
      setTeam([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { team, setTeam, loading, refresh };
}
