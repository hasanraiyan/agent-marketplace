"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnectors } from "../connectors-context";
import { Cpu, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SkillsListPage() {
  const router = useRouter();
  const { mySkills, loading } = useConnectors();

  useEffect(() => {
    if (!loading && mySkills.length > 0) {
      router.replace(`/dashboard/connectors/skills/${mySkills[0]._id || mySkills[0].id}`);
    }
  }, [mySkills, loading, router]);

  if (loading) return null;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
      <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
        <Cpu className="size-8" />
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
        No skills yet
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
        You haven&apos;t created any skills yet. Skills provide specialized instructions and capabilities for your agents.
      </p>
      <Link href="/dashboard/connectors/skills/new" className="mt-6">
        <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
          <Plus className="mr-1.5 size-4" />
          Create Your First Skill
        </Button>
      </Link>
    </div>
  );
}
