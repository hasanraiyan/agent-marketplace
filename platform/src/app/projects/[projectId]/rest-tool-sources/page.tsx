"use client";

import { useParams } from "next/navigation";
import { GlobeSimpleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectRestToolSources } from "@/lib/api/projects";

interface RestApiToolSummary {
  name: string;
  method: string;
  url: string;
}

interface RestApiToolSource {
  _id: string;
  name: string;
  url: string;
  authType?: string;
  isEnabled?: boolean;
  hasSecret?: boolean;
  tools?: RestApiToolSummary[];
}

export default function RestToolSourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<RestApiToolSource>
      title="Tool Sources"
      description="Hosted manifest URLs — Persona discovers your code-defined REST tools from them, the same way it discovers an MCP server&apos;s tools."
      icon={GlobeSimpleIcon}
      fetchItems={() => getProjectRestToolSources(projectId)}
      cacheKey={`GET /projects/${projectId}/rest-tool-sources`}
      newHref={`/projects/${projectId}/rest-tool-sources/new`}
      getRowHref={(source) =>
        `/projects/${projectId}/rest-tool-sources/${source._id}/edit`
      }
      emptyDescription="Register a hosted manifest URL so Agents can call your code-defined REST tools."
      columns={[
        { header: "Name", cell: (source) => source.name },
        {
          header: "URL",
          cell: (source) => (
            <span className="font-mono text-xs text-muted-foreground">
              {source.url}
            </span>
          ),
          className: "max-w-[360px] truncate",
        },
        {
          header: "Auth",
          cell: (source) => (
            <Badge
              variant={source.authType === "apiKey" ? "outline" : "secondary"}
              className={
                source.authType === "apiKey"
                  ? "border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-secondary text-secondary-foreground border-transparent"
              }
            >
              {source.authType === "apiKey" ? "API key" : "None"}
            </Badge>
          ),
        },
        {
          header: "Tools",
          cell: (source) => source.tools?.length ?? 0,
        },
      ]}
    />
  );
}
