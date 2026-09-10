import * as React from "react";
import Link from "next/link";

interface DocsBreadcrumbsProps {
  sdk: string;
  version: string;
  slug: string[];
  title: string;
}

export function DocsBreadcrumbs({
  sdk,
  version,
  slug,
  title,
}: DocsBreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-muted-foreground">
      <Link href="/docs" className="hover:text-foreground">
        Docs
      </Link>
      <span>/</span>
      <Link href={`/docs/${sdk}/v${version}`} className="hover:text-foreground">
        {sdk}
      </Link>
      <span>/</span>
      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
        v{version}
      </span>
      {slug.length > 0 && (
        <>
          <span>/</span>
          {slug.slice(0, -1).map((segment, idx) => (
            <React.Fragment key={idx}>
              <span className="capitalize">{segment.replace(/[-_]/g, " ")}</span>
              <span>/</span>
            </React.Fragment>
          ))}
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {title}
          </span>
        </>
      )}
    </nav>
  );
}
