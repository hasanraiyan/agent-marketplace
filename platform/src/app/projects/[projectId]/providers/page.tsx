"use client";

import { useParams } from "next/navigation";
import { CpuIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectProviders } from "@/lib/api/projects";

interface Provider {
  _id?: string;
  id: string;
  label: string;
  type: string;
  baseURL: string;
  defaultModel: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function ProvidersPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Provider>
      title="Providers"
      description="Model providers an Agent can use — OpenAI, Anthropic, Gemini, DeepSeek or any OpenAI-compatible endpoint."
      icon={CpuIcon}
      fetchItems={() => getProjectProviders(projectId)}
      cacheKey={`GET /projects/${projectId}/providers`}
      newHref={`/projects/${projectId}/providers/new`}
      getRowHref={(provider) => `/projects/${projectId}/providers/${provider.id ?? provider._id}/edit`}
      emptyDescription="Add a provider (OpenAI, Anthropic, etc.) to power your Agents."
      columns={[
        {
          header: "Label",
          cell: (p) => (
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{p.label}</span>
              {p.isDefault && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                  Default
                </Badge>
              )}
            </span>
          ),
        },
        { header: "Type", cell: (p) => <span className="capitalize">{p.type || "—"}</span> },
        {
          header: "Base URL",
          className: "hidden md:table-cell",
          cell: (p) => <span className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">{p.baseURL || "—"}</span>,
        },
        {
          header: "Default Model",
          className: "hidden lg:table-cell",
          cell: (p) => <span className="font-mono text-xs">{p.defaultModel || "—"}</span>,
        },
      ]}
    />
  );
}
