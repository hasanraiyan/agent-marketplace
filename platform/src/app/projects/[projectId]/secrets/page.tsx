"use client";

import { useParams } from "next/navigation";
import { LockKeyIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectSecrets } from "@/lib/api/projects";

interface Secret {
  _id: string;
  name: string;
  description?: string;
}

export default function SecretsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Secret>
      title="Secrets"
      description="Bearer tokens the REST Tool Builder's Auth tab can reference — values are never shown again after creation."
      icon={LockKeyIcon}
      fetchItems={() => getProjectSecrets(projectId)}
      newHref={`/projects/${projectId}/secrets/new`}
      getRowHref={(secret) => `/projects/${projectId}/secrets/${secret._id}/edit`}
      emptyDescription="Store a secret to authenticate REST tools without exposing the value in a tool's config."
      columns={[
        { header: "Name", cell: (secret) => secret.name },
        { header: "Description", cell: (secret) => secret.description || "—" },
      ]}
    />
  );
}
