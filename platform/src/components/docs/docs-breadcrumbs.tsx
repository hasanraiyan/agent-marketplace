"use client";

import * as React from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";

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
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/docs" />}>Docs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={`/docs/${sdk}/v${version}`} />}>
            {sdk}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <Badge
            variant="secondary"
            className="font-mono text-[11px] px-1.5 py-0.5 text-muted-foreground"
          >
            v{version}
          </Badge>
        </BreadcrumbItem>
        {slug.length > 0 && (
          <>
            {slug.slice(0, -1).map((segment, idx) => (
              <React.Fragment key={idx}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <span className="capitalize">{segment.replace(/[-_]/g, " ")}</span>
                </BreadcrumbItem>
              </React.Fragment>
            ))}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[200px] truncate font-medium text-foreground">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
