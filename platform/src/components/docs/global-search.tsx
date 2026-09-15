"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState<SearchDoc[] | null>(null);

  React.useEffect(() => {
    fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
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
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-8 w-56 justify-between bg-background/80 px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:w-64"
      >
        <span className="flex items-center gap-2">
          <MagnifyingGlassIcon className="size-3.5 text-muted-foreground" />
          <span>Search docs…</span>
        </span>
        <Kbd className="h-4 px-1 text-[10px]">⌘K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Documentation"
        description="Search across all SDKs and guides"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search docs..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {results.length === 0 ? (
              <CommandEmpty>
                {query.trim()
                  ? "No matching documents found."
                  : "Type to search documentation across all SDKs..."}
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Results">
                {results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={String(r.id)}
                    onSelect={() => {
                      setOpen(false);
                      router.push(r.href);
                    }}
                    className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{r.title}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {r.sdk}
                      </Badge>
                    </div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.description}
                      </p>
                    )}
                    {r.snippet && (
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-1 font-mono">
                        {r.snippet.slice(0, 100)}
                      </p>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
