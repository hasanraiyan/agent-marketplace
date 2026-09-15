"use client";

import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { DocsNavItem } from "@/lib/docs/mdx";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DocsPagerProps {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
}

export function DocsPager({ prev, next }: DocsPagerProps) {
  if (!prev && !next) return null;

  return (
    <div className="mt-12 space-y-6">
      <Separator />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {prev ? (
          <Link href={prev.href} className="group flex-1">
            <Card
              size="sm"
              className="transition-all hover:bg-muted/50 hover:ring-1 hover:ring-border"
            >
              <CardHeader className="gap-1 p-4">
                <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                  <CaretLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                  Previous
                </CardDescription>
                <CardTitle className="text-sm font-medium text-foreground">
                  {prev.title}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <Link href={next.href} className="group flex-1">
            <Card
              size="sm"
              className="text-right transition-all hover:bg-muted/50 hover:ring-1 hover:ring-border"
            >
              <CardHeader className="items-end gap-1 p-4">
                <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                  Next
                  <CaretRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </CardDescription>
                <CardTitle className="text-sm font-medium text-foreground">
                  {next.title}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
