"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSdks } from "@/lib/docs/registry";

export function DocsHeaderNav() {
  const pathname = usePathname();
  const sdks = getSdks();

  const labels: Record<string, string> = {
    react: "React",
    sdk: "SDK",
    runtime: "Runtime",
    adapters: "Adapters",
  };

  return (
    <nav className="flex items-center gap-1">
      {sdks.map((sdk) => {
        const prefix = `/docs/${sdk.id}`;
        const isActive = pathname.startsWith(prefix);
        const href = `/docs/${sdk.id}/v${sdk.latest}`;
        const label = labels[sdk.id] || sdk.id;

        return (
          <Button
            key={sdk.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className={
              isActive
                ? "font-medium text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }
            render={<Link href={href} />}
          >
            {label}
          </Button>
        );
      })}
    </nav>
  );
}
