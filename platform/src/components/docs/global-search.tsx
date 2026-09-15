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

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    terms.some((t) => part.toLowerCase() === t.toLowerCase()) ? (
      <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 dark:bg-yellow-800">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function GlobalSearch() {
  const [query, setQuery] = React.useState("");
  const [docIndex, setDocIndex] = React.useState<import("flexsearch").Document<SearchDoc> | null>(null);
  const [store, setStore] = React.useState<Map<number, SearchDoc> | null>(null);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    import("flexsearch").then(({ Document }) => {
      fetch("/search-index.json")
        .then((r) => (r.ok ? r.json() : []))
        .then((docs: SearchDoc[]) => {
          if (cancelled) return;
          const m = new Map<number, SearchDoc>();
          for (const d of docs) m.set(d.id, d);
          setStore(m);
          const doc = new Document<SearchDoc>({
            tokenize: "forward",
            document: {
              id: "id",
              index: [
                { field: "title", tokenize: "forward", resolution: 9 },
                { field: "description", tokenize: "forward", resolution: 5 },
                { field: "tokens", tokenize: "forward" },
              ],
              store: ["href", "title", "description", "snippet", "sdk"],
            },
          });
          for (const d of docs) doc.add(d);
          setDocIndex(doc as unknown as import("flexsearch").Document<SearchDoc>);
        })
        .catch(() => {
          setStore(new Map());
          setDocIndex(null);
        });
    });
    return () => {
      cancelled = true;
    };
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

  const results = React.useMemo<SearchDoc[]>(() => {
    if (!query.trim() || !docIndex || !store) return [];
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      const raw = docIndex.search(q, { limit: 10, enrich: true }) as unknown as Array<{
        field: string;
        result: Array<{ id: number; doc?: SearchDoc }>;
      }>;
      const seen = new Set<number>();
      const out: SearchDoc[] = [];
      for (const field of raw) {
        for (const hit of field.result) {
          if (seen.has(hit.id)) continue;
          seen.add(hit.id);
          const d = (hit.doc as SearchDoc) ?? store.get(hit.id);
          if (d) out.push(d);
          if (out.length >= 10) break;
        }
        if (out.length >= 10) break;
      }
      if (out.length === 0) {
        const lower = q.toLowerCase();
        for (const d of store.values()) {
          if (d.tokens.includes(lower) || d.title.toLowerCase().includes(lower)) {
            out.push(d);
            if (out.length >= 10) break;
          }
        }
      }
      return out;
    } catch {
      const lower = q.toLowerCase();
      const out: SearchDoc[] = [];
      for (const d of store!.values()) {
        if (d.tokens.includes(lower)) {
          out.push(d);
          if (out.length >= 10) break;
        }
      }
      return out;
    }
  }, [query, docIndex, store]);

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
                        {highlight(r.title, query)}
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
                        {highlight(r.description, query)}
                      </p>
                    )}
                    {r.snippet && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                        {highlight(r.snippet.slice(0, 80), query)}
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
