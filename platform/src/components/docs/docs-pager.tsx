import Link from "next/link";
import { DocsNavItem } from "@/lib/docs/mdx";

interface DocsPagerProps {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
}

export function DocsPager({ prev, next }: DocsPagerProps) {
  if (!prev && !next) return null;

  return (
    <div className="mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col items-start gap-1 rounded-lg border border-border p-4 transition-all hover:border-blue-600 hover:bg-accent/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-blue-600">
            <svg
              className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-blue-600">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-all hover:border-blue-600 hover:bg-accent/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-blue-600">
            Next
            <svg
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-blue-600">
            {next.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
