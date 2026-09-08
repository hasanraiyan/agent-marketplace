"use client";

import { useParams } from "next/navigation";
import { SparkleIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectSkills } from "@/lib/api/projects";

interface Skill {
  _id: string;
  name: string;
  description?: string;
}

export default function SkillsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Skill>
      title="Skills"
      description="Reusable instruction/skill files an Agent can load."
      icon={SparkleIcon}
      fetchItems={() => getProjectSkills(projectId)}
      cacheKey={`GET /projects/${projectId}/skills`}
      newHref={`/projects/${projectId}/skills/new`}
      getRowHref={(skill) => `/projects/${projectId}/skills/${skill._id}/edit`}
      emptyDescription="Create a Skill to package reusable instructions an Agent can load."
      columns={[
        { header: "Name", cell: (skill) => skill.name },
        { header: "Description", cell: (skill) => skill.description || "—" },
      ]}
    />
  );
}
