"use client";

import { useState, useEffect, use } from "react";
import { getSkill } from "@/lib/api/skills";
import { SkillEditor } from "@/components/skills/skill-editor";
import { toast } from "sonner";

export default function SkillEditPage({ params }) {
  const resolvedParams = use(params);
  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resolvedParams.id) {
      getSkill(resolvedParams.id)
        .then((res) => setSkill(res.data?.data))
        .catch(() => toast.error("Failed to load skill"))
        .finally(() => setLoading(false));
    }
  }, [resolvedParams.id]);

  if (loading) return null;

  return <SkillEditor skill={skill} mode="edit" />;
}
