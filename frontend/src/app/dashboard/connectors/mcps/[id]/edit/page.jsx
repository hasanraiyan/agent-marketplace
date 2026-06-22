"use client";

import { useState, useEffect, use } from "react";
import { getMcp } from "@/lib/api/mcps";
import { McpEditor } from "@/components/skills/mcp-editor";
import { toast } from "sonner";

export default function McpEditPage({ params }) {
  const resolvedParams = use(params);
  const [mcp, setMcp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resolvedParams.id) {
      getMcp(resolvedParams.id)
        .then((res) => setMcp(res.data?.data))
        .catch(() => toast.error("Failed to load MCP server"))
        .finally(() => setLoading(false));
    }
  }, [resolvedParams.id]);

  if (loading) return null;

  if (!mcp) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <p>MCP server not found</p>
      </div>
    );
  }

  return <McpEditor mcp={mcp} mode="edit" />;
}
