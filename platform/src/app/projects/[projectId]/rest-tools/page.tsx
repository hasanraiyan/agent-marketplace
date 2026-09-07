"use client";

import { useParams } from "next/navigation";
import { HammerIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectRestTools } from "@/lib/api/projects";

interface RestApiTool {
  _id: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  authType?: string;
  isEnabled?: boolean;
  hasSecret?: boolean;
}

// Soft color per HTTP verb, emerald "active" style like the credentials page.
function methodBadgeClass(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "POST":
      return "border-sky-500/20 bg-sky-500/15 text-sky-600 dark:text-sky-400";
    case "PUT":
    case "PATCH":
      return "border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "DELETE":
      return "border-rose-500/20 bg-rose-500/15 text-rose-600 dark:text-rose-400";
    default:
      return "bg-secondary text-secondary-foreground border-transparent";
  }
}

export default function RestToolsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<RestApiTool>
      title="REST Tools"
      description="No-code REST tools this Project&apos;s Agents can call."
      icon={HammerIcon}
      fetchItems={() => getProjectRestTools(projectId)}
      newHref={`/projects/${projectId}/rest-tools/new`}
      getRowHref={(tool) => `/projects/${projectId}/rest-tools/${tool._id}/edit`}
      emptyDescription="Build a no-code REST tool from a URL, auth, and param mapping."
      columns={[
        {
          header: "Method",
          cell: (tool) => (
            <Badge variant="outline" className={methodBadgeClass(tool.method)}>
              {tool.method.toUpperCase()}
            </Badge>
          ),
        },
        { header: "Name", cell: (tool) => tool.name },
        {
          header: "URL",
          cell: (tool) => (
            <span className="font-mono text-xs text-muted-foreground">
              {tool.url}
            </span>
          ),
          className: "max-w-[360px] truncate",
        },
      ]}
    />
  );
}
