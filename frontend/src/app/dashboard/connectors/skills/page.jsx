"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnectors } from "../connectors-context";
import { Cpu, ArrowLeft } from "lucide-react";

export default function SkillsListPage() {
  const router = useRouter();
  const { mySkills, loading } = useConnectors();

  useEffect(() => {
    if (!loading && mySkills.length > 0) {
      router.replace(`/dashboard/connectors/skills/${mySkills[0]._id || mySkills[0].id}`);
    }
  }, [mySkills, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-500">
      <Cpu className="size-12 mb-4 opacity-10" />
      <div className="flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4" />
        <p>Select or create a skill to get started</p>
      </div>
    </div>
  );
}
