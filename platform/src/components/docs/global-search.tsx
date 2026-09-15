"use client";

import * as React from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";

type SearchDoc = {
  id: number;
  sdk: string;
  version: string;
  href: string;
  title: string;
  description?: string;
  snippet: string;
  tokens: string;
};

export function GlobalSearch() {
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState<SearchDoc[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  React.useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const results = React.useMemo(() => {
    if (!query.trim() || !index) return [];
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = index
      .map((d) => {
        let score = 0;
        for (const t of terms) {
          if (d.title.toLowerCase().includes(t)) score += 10;
          else if (d.description?.toLowerCase().includes(t)) score += 5;
          else if (d.tokens.includes(t)) score += 1;
          else score = -1;
        }
        return { d, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ d }) => d);
    return scored;
  }, [query, index]);

  return (
    <div ref={containerRef} className="relative w-56 sm:w-64">
      <InputGroup className="h-8 bg-background">
        <InputGroupAddon align="inline-start">
          <MagnifyingGlassIcon className="size-3.5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search docs…"
          className="text-xs"
        />
        <InputGroupAddon align="inline-end">
          <Kbd className="h-4 px-1 text-[10px]">⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>

      {open && query.trim() && (
        <Card className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-hidden p-0 shadow-lg">
          <ScrollArea className="max-h-80">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matching results found
              </div>
            ) : (
              <div className="divide-y divide-border/40 p-1">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-sm px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {r.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 font-mono text-[10px]"
                      >
                        {r.sdk}
                      </Badge>
                    </div>
                    {r.description && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    {r.snippet && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                        {r.snippet.slice(0, 80)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
