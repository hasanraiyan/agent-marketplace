"use client";

import { useParams } from "next/navigation";
import { BookOpenIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectKnowledge } from "@/lib/api/projects";

interface KnowledgeBase {
  _id: string;
  name: string;
  description?: string;
}

export default function KnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<KnowledgeBase>
      title="Knowledge"
      description="Knowledge Bases an Agent can search."
      icon={BookOpenIcon}
      fetchItems={() => getProjectKnowledge(projectId)}
      newHref={`/projects/${projectId}/knowledge/new`}
      getRowHref={(kb) => `/projects/${projectId}/knowledge/${kb._id}`}
      emptyDescription="Create a Knowledge Base and upload documents for your Agents to search."
      columns={[
        { header: "Name", cell: (kb) => kb.name },
        { header: "Description", cell: (kb) => kb.description || "—" },
      ]}
    />
  );
}
