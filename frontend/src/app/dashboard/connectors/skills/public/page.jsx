"use client";

import { useEffect, useState } from "react";
import { getPublicSkills } from "@/lib/api/skills";
import { Card } from "@/components/ui/card";
import { Cpu, Globe, ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { useConnectors } from "../../connectors-context";

export default function PublicSkillsPage() {
  const { publicSkills: skills, loading } = useConnectors();

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <h1 className="text-xl font-bold">Public Marketplace</h1>
        <p className="text-xs text-muted-foreground">Discover and import specialized skills created by the community.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card key={skill._id || skill.id} className="group flex flex-col p-5 hover:shadow-md transition-all border-none ring-1 ring-foreground/10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm truncate max-w-[150px]">{skill.name}</h3>
                    <Badge variant="default" className="text-[8px] uppercase h-4 px-1 py-0">
                      <Globe className="size-2 mr-1" /> Public
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-4 flex-1">
                {skill.description}
              </p>
              <div className="flex items-center justify-between pt-3 border-t">
                 <span className="text-[10px] text-muted-foreground uppercase font-medium">
                  By {skill.ownerId?.username || "Unknown"}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/dashboard/connectors/skills/${skill._id || skill.id}`}>
                    View <ExternalLink className="ml-1 size-3" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
          {skills.length === 0 && !loading && (
             <div className="col-span-full py-20 text-center text-muted-foreground italic">
                No public skills found in the marketplace yet.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
