"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Chips + a text box. Enter or comma commits the draft; Backspace on an empty
 * box removes the last chip.
 */
export function TagInput({ value = [], onChange, placeholder, max = 30 }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const next = draft.trim().replace(/,+$/, "").trim();
    if (!next) return;
    if (value.includes(next) || value.length >= max) {
      setDraft("");
      return;
    }
    onChange([...value, next]);
    setDraft("");
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 pr-1 pl-2.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => remove(idx)}
            className="flex size-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            remove(value.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Ordered list of single-line strings with add/remove (and optional reorder). */
export function StringListEditor({
  value = [],
  onChange,
  placeholder,
  addLabel = "Add",
  reorder = false,
  max = 12,
}) {
  const update = (idx, text) =>
    onChange(value.map((item, i) => (i === idx ? text : item)));
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            value={item}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          {reorder ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                aria-label="Move up"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={idx === value.length - 1}
                onClick={() => move(idx, 1)}
                aria-label="Move down"
              >
                <ArrowDownIcon />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(idx)}
            aria-label="Remove"
            className="text-slate-400 hover:text-rose-600"
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= max}
        onClick={() => onChange([...value, ""])}
        className={cn("w-fit rounded-full font-bold")}
      >
        <PlusIcon />
        {addLabel}
      </Button>
    </div>
  );
}
