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
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {newHref && (
          <Button size="sm" render={<a href={newHref} />}>
            <PlusIcon />
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
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.header}>{col.header}</TableHead>
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
                      {col.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export { ResourceListPage };
export type { ResourceColumn };
