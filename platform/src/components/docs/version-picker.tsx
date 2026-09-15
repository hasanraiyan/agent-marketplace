"use client";

import { useRouter, usePathname } from "next/navigation";
import { getVersions } from "@/lib/docs/registry";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VersionPicker({ sdk, current }: { sdk: string; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const versions = getVersions(sdk);

  const handleValueChange = (val: string | null) => {
    if (!val) return;
    // replace /docs/<sdk>/<oldVersion>/... with new version, keep slug
    const parts = pathname.split("/");
    // /docs/react/v0.8.1/hooks/useChat -> docs, react, v0.8.1, ...
    if (parts[3]?.startsWith("v")) parts[3] = `v${val}`;
    else parts.splice(3, 0, `v${val}`);
    router.push(parts.join("/") || `/docs/${sdk}/v${val}`);
  };

  return (
    <Select value={current} onValueChange={handleValueChange}>
      <SelectTrigger size="sm" className="h-7 bg-background text-xs">
        <SelectValue placeholder={`v${current}`}>
          v{current}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {versions.map((v) => (
          <SelectItem key={v} value={v}>
            v{v} {v === versions[0] ? "(latest)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
