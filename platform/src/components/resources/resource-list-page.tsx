"use client";

import * as React from "react";
import type { AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import type { Icon } from "@phosphor-icons/react";
import { getCached, setCached, dedupedFetch } from "@/lib/cache";

interface ResourceColumn<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

/**
 * Every Project resource type (Agents, RCP Sources, MCP, Providers,
 * Secrets, Knowledge, Stores, Skills) is a flat "fetch, list, click a row"
 * page — same shape, different fetcher/columns. One component for all of
 * them keeps that shape consistent instead of eight near-identical
 * hand-rolled pages, and is the concrete fix for the old UX (these lived
 * as tabs buried inside a project overview page with no shared pattern).
 */
function getItemId(item: { _id?: string; id?: string }) {
  return (item as { _id?: string; id?: string }).id ?? (item as { _id?: string; id?: string })._id ?? "";
}

function ResourceListPage<T extends { _id?: string; id?: string }>({
  title,
  description,
  icon: Icon,
  fetchItems,
  columns,
  getRowHref,
  newHref,
  emptyDescription,
  cacheKey,
}: {
  title: string;
  description?: string;
  icon: Icon;
  fetchItems: () => Promise<AxiosResponse>;
  columns: ResourceColumn<T>[];
  getRowHref?: (item: T) => string;
  newHref?: string;
  emptyDescription?: string;
  cacheKey?: string;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<T[] | null>(() => {
    if (cacheKey) {
      const cached = getCached<T[]>(cacheKey);
      return cached ?? null;
    }
    return null;
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const key = cacheKey;
    // If we already have cached data, don't show skeleton — just revalidate silently.
    const hasCached = key ? !!getCached<T[]>(key) : false;
    if (hasCached) setIsRevalidating(true);

    const fetcher = () =>
      fetchItems().then((res) => {
        const raw = res.data?.data;
        const normalized = Array.isArray(raw) ? raw : (raw?.items ?? raw ?? []);
        return normalized as T[];
      });

    const promise = key ? dedupedFetch<T[]>(key, fetcher) : fetcher();

    promise
      .then((normalized) => {
        if (cancelled) return;
        if (key) setCached(key, normalized);
        setItems(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep cached data if we have it, just surface the error subtly.
        if (!hasCached) {
          setError("Failed to load.");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsRevalidating(false);
      });
    return () => {
      cancelled = true;
    };
    // fetchItems is a fresh function reference on every render (the caller
    // builds it inline), so only re-run when the underlying route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
          {description && (
            <p className="line-clamp-3 max-w-xl text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs">
              {description}
            </p>
          )}
        </div>
        {newHref && (
          <Button size="sm" className="w-fit shrink-0" render={<Link href={newHref} />}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        )}
      </div>
      {isRevalidating && items && (
        <div className="h-0.5 w-full overflow-hidden rounded bg-muted">
          <div className="h-full w-1/3 animate-[shimmer_1s_ease-in-out_infinite] bg-primary/40" />
        </div>
      )}

      {items === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>No {title.toLowerCase()} yet</EmptyTitle>
            {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
          </EmptyHeader>
          {newHref && (
            <EmptyContent>
              <Button size="sm" render={<a href={newHref} />}>
                <PlusIcon />
                New
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.header} className={col.className}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const href = getRowHref?.(item);
                  const itemId = getItemId(item as { _id?: string; id?: string });
                  return (
                    <TableRow
                      key={itemId || JSON.stringify(item)}
                      className={href ? "cursor-pointer hover:bg-muted/50" : undefined}
                      onClick={href ? () => router.push(href) : undefined}
                    >
                      {columns.map((col) => (
                        <TableCell key={col.header} className={col.className}>
                          <div className="truncate">{col.cell(item)}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Mobile: stacked cards — only first column (label/name) + tap to edit */}
          <div className="flex flex-col gap-2 sm:hidden">
            {items.map((item) => {
              const href = getRowHref?.(item);
              const itemId = getItemId(item as { _id?: string; id?: string });
              const primary = columns[0] ? columns[0].cell(item) : null;
              const secondary = columns[1] ? columns[1].cell(item) : null;
              return (
                <button
                  key={itemId || JSON.stringify(item)}
                  type="button"
                  onClick={href ? () => router.push(href) : undefined}
                  className="flex w-full items-center justify-between gap-3 rounded-none border border-border bg-card px-3 py-2.5 text-left active:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{primary}</span>
                  {secondary && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">{secondary}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export { ResourceListPage };
export type { ResourceColumn };
