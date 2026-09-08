"use client";

import * as React from "react";
import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// One attachable resource from a Project list (Skills, Knowledge, MCP, REST
// Tools, RCP Sources, Stores). The Agent schema stores each attach group as an
// array of ObjectIds, so the picker works in id-space throughout — the raw list
// rows are normalized once by the caller into this {_id|id, name, meta?} shape.
export interface AttachItem {
  _id?: string;
  id?: string;
  name: string;
  meta?: string;
}

export function attachId(item: AttachItem) {
  return item.id ?? item._id ?? "";
}

function AttachPicker({
  field,
  title,
  hint,
  items,
  loading,
  selected,
  onToggle,
  createHref,
  emptyNoun,
}: {
  field: string;
  title: string;
  hint: string;
  items: AttachItem[];
  loading: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  createHref: string;
  emptyNoun: string;
}) {
  const selectedCount = selected.length;

  return (
    <div className="flex flex-col gap-2 rounded-none border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-tight">{title}</span>
          <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
        </div>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {selectedCount}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ) : items.length === 0 ? (
        <Link
          href={createHref}
          className="flex items-center justify-center gap-1.5 rounded-none border border-dashed border-border px-2 py-3 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <PlusIcon className="size-3.5" />
          Create {emptyNoun}
        </Link>
      ) : (
        <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const id = attachId(item);
            const isSelected = selected.includes(id);
            return (
              <label
                key={id}
                htmlFor={`agent-${field}-${id}`}
                className={`flex cursor-pointer items-center gap-2.5 rounded-none border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:bg-muted/40"
                }`}
              >
                <Checkbox
                  id={`agent-${field}-${id}`}
                  checked={isSelected}
                  onCheckedChange={() => onToggle(id)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium">{item.name}</span>
                  {item.meta ? (
                    <span className="truncate text-[11px] text-muted-foreground">{item.meta}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { AttachPicker };
