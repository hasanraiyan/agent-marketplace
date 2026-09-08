"use client";

import { useParams } from "next/navigation";
import { BookOpenIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectKnowledge } from "@/lib/api/projects";

interface KnowledgeBase {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  chunkCount?: number;
  embeddingModel?: string;
  providerId?: string | { _id: string; label: string };
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function KnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<KnowledgeBase>
      title="Knowledge"
      description="Knowledge Bases an Agent can search — upload PDF, TXT, MD, CSV, JSON and search semantically."
      icon={BookOpenIcon}
      fetchItems={() => getProjectKnowledge(projectId)}
      cacheKey={`GET /projects/${projectId}/knowledge`}
      newHref={`/projects/${projectId}/knowledge/new`}
      getRowHref={(kb) => `/projects/${projectId}/knowledge/${kb.id ?? kb._id}`}
      emptyDescription="Create a Knowledge Base and upload documents for your Agents to search."
      columns={[
        { header: "Name", cell: (kb) => <span className="truncate font-medium">{kb.name}</span> },
        {
          header: "Docs",
          className: "hidden sm:table-cell",
          cell: (kb) => <span className="font-mono text-xs">{kb.documentCount ?? 0} docs · {kb.chunkCount ?? 0} chunks</span>,
        },
        {
          header: "Embedding",
          className: "hidden lg:table-cell",
          cell: (kb) => <span className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">{kb.embeddingModel || "text-embedding-3-small"}</span>,
        },
      ]}
    />
  );
}
