"use client";

import { studioRoutes } from "@/lib/studio-routes";

import { useState, useMemo } from "react";
import { useConnectors } from "@/components/connectors/connectors-context";
import { BookText, Plus, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export default function KnowledgeBasesListPage() {
  const { knowledgeBases, loadingKnowledgeBases } = useConnectors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return knowledgeBases;
    return knowledgeBases.filter((kb) => {
      const name = (kb.name || "").toLowerCase();
      const desc = (kb.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [knowledgeBases, search]);

  if (loadingKnowledgeBases) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (knowledgeBases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto mt-8">
        <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
          <BookText className="size-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
          No knowledge bases yet
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
          Knowledge bases let you upload documents (PDF, TXT, MD) that your
          agents can search using AI-powered semantic retrieval.
        </p>
        <Link href={studioRoutes.knowledgeNew} className="mt-6">
          <Button className="rounded-full px-6 py-2.5 font-bold shadow-sm active:scale-98 transition-all">
            <Plus className="mr-1.5 size-4" />
            Create Your First Knowledge Base
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Mobile Search */}
      <div className="md:hidden">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search knowledge bases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-base"
          />
        </InputGroup>
      </div>

      {/* KB cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((kb) => {
          const id = kb._id || kb.id;
          return (
            <Link
              key={id}
              href={studioRoutes.knowledgeBase(id)}
              className="group flex flex-col rounded-2xl border border-zinc-150/60 dark:border-zinc-900/60 bg-card p-5 hover:border-emerald-500/30 transition-all duration-200 active:scale-[0.98]"
            >
              {/* Top: Icon + Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="size-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 dark:from-emerald-500/10 dark:to-teal-600/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <BookText className="size-5" />
                </div>
                <Badge
                  variant={kb.documentCount > 0 ? "default" : "outline"}
                  className="text-[8px] h-4 px-1.5 uppercase font-bold"
                >
                  {kb.documentCount || 0} docs
                </Badge>
              </div>

              {/* Content */}
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {kb.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                {kb.description || "No description"}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-150/60 dark:border-zinc-900/60">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {kb.chunkCount || 0} chunks
                </span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded">
                  RAG
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* No search results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-lg mx-auto">
          <div className="size-12 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4 text-zinc-400 dark:text-zinc-600">
            <SearchIcon className="size-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-150">
            No knowledge bases match
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Try a different search term
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearch("")}
            className="mt-4 rounded-full font-bold"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
