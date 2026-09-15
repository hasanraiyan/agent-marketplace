"use client";

import * as React from "react";
import Link from "next/link";

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
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
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
      .slice(0, 8)
      .map(({ d }) => d);
    return scored;
  }, [query, index]);

  return (
    <div ref={ref} className="relative w-64">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search docs…"
        className="w-full rounded-md border border-input bg-background/80 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-600"
      />
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results</div>
          ) : (
            <ul className="py-1">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-accent"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="truncate">{r.title}</span>
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {r.sdk}
                      </span>
                    </div>
                    {r.description && (
                      <div className="truncate text-[11px] text-muted-foreground">{r.description}</div>
                    )}
                    <div className="truncate text-[11px] text-muted-foreground/70">{r.snippet.slice(0, 80)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
