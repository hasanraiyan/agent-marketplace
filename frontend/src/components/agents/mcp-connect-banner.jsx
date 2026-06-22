"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserConnectionStatus, getUserAuthorizeUrl } from "@/lib/api/mcps";

/**
 * Non-blocking banner that prompts the current user to connect their own
 * account to any per-user-auth MCP connectors attached to this agent.
 * Connecting is optional - the agent still works without it, just without
 * that connector's tools (see resolveMcpTools on the backend).
 */
export function McpConnectBanner({ mcps }) {
  const [statuses, setStatuses] = useState({});
  const [dismissed, setDismissed] = useState(false);
  const [connectingId, setConnectingId] = useState(null);

  const perUserMcps = useMemo(
    () =>
      (mcps || []).filter(
        (m) => m.authType === "oauth" && m.authMode === "user" && m.isEnabled !== false
      ),
    [mcps]
  );
  const idsKey = perUserMcps.map((m) => m._id).join(",");

  useEffect(() => {
    if (perUserMcps.length === 0) return;
    let cancelled = false;

    Promise.all(
      perUserMcps.map((m) =>
        getUserConnectionStatus(m._id)
          .then((res) => [m._id, Boolean(res.data?.data?.connected)])
          .catch(() => [m._id, false])
      )
    ).then((entries) => {
      if (!cancelled) setStatuses(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const handleConnect = useCallback(async (mcpId) => {
    setConnectingId(mcpId);
    try {
      const returnTo = typeof window !== "undefined" ? window.location.href : undefined;
      const res = await getUserAuthorizeUrl(mcpId, returnTo);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
    } finally {
      setConnectingId(null);
    }
  }, []);

  const unconnected = perUserMcps.filter((m) => statuses[m._id] === false);

  if (dismissed || unconnected.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 shrink-0" />
        <span>
          Connect {unconnected.map((m) => m.name).join(", ")} to unlock{" "}
          {unconnected.length === 1 ? "its tools" : "their tools"}.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {unconnected.map((m) => (
          <Button
            key={m._id}
            size="sm"
            variant="outline"
            className="h-7 bg-white text-xs"
            onClick={() => handleConnect(m._id)}
            disabled={connectingId === m._id}
          >
            {connectingId === m._id && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            Connect {m.name}
          </Button>
        ))}
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={() => setDismissed(true)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
