"use client";

import * as React from "react";
import type { AxiosResponse } from "axios";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import type { Icon } from "@phosphor-icons/react";

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
}: {
  title: string;
  description?: string;
  icon: Icon;
  fetchItems: () => Promise<AxiosResponse>;
  columns: ResourceColumn<T>[];
  getRowHref?: (item: T) => string;
  newHref?: string;
  emptyDescription?: string;
}) {
  const [items, setItems] = React.useState<T[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchItems()
      .then((res) => {
        const raw = res.data?.data;
        // Backend is adapting case-by-case: audit-logs wraps with paginationEnvelope {items, pagination},
        // most resources return a bare array today, secrets returns {id,label} without _id.
        // Normalize once here so every resource page doesn't re-implement it.
        const normalized = Array.isArray(raw) ? raw : (raw?.items ?? raw ?? []);
        if (!cancelled) setItems(normalized);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load.");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // fetchItems is a fresh function reference on every render (the caller
    // builds it inline), so only re-run when the underlying route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Button size="sm" className="w-fit shrink-0" render={<a href={newHref} />}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        )}
      </div>

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
                      className={href ? "cursor-pointer" : undefined}
                      onClick={href ? () => (window.location.href = href) : undefined}
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
                  onClick={href ? () => (window.location.href = href) : undefined}
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
