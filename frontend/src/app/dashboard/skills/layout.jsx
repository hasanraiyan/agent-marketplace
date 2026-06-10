"use client";

import { SkillsNav } from "@/components/skills/skills-nav";
import { SkillsProvider, useSkills } from "./skills-context";

function SkillsLayoutContent({ children }) {
  const { mySkills, publicSkills, loading } = useSkills();

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      <SkillsNav mySkills={mySkills} publicSkills={publicSkills} />
      <main className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="size-8 border-4 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function SkillsLayout({ children }) {
  return (
    <SkillsProvider>
      <SkillsLayoutContent>{children}</SkillsLayoutContent>
    </SkillsProvider>
  );
}
