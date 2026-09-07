"use client";

import { useParams } from "next/navigation";
import { PlugsConnectedIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectMcps } from "@/lib/api/projects";

interface Mcp {
  _id: string;
  name: string;
  url?: string;
}

export default function McpsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Mcp>
      title="MCP"
      description="Model Context Protocol servers an Agent can connect to."
      icon={PlugsConnectedIcon}
      fetchItems={() => getProjectMcps(projectId)}
      newHref={`/projects/${projectId}/mcps/new`}
      getRowHref={(mcp) => `/projects/${projectId}/mcps/${mcp._id}/edit`}
      emptyDescription="Register an MCP server to give Agents new tools."
      columns={[
        { header: "Name", cell: (mcp) => mcp.name },
        { header: "URL", cell: (mcp) => mcp.url || "—" },
      ]}
    />
  );
}
