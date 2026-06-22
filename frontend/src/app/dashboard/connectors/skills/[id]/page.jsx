"use client";

import { useState, useEffect, use } from "react";
import { getSkill } from "@/lib/api/skills";
import { SkillDetail } from "@/components/skills/skill-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SkillDetailPage({ params }) {
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

  if (loading) {
    return (
      <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-48 rounded-2xl w-full" />
              <Skeleton className="h-64 rounded-2xl w-full" />
              <Skeleton className="h-64 rounded-2xl w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-80 rounded-2xl w-full" />
              <Skeleton className="h-40 rounded-2xl w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SkillDetail skill={skill} />;
}
