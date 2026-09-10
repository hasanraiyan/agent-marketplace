"use client";
import { useRouter, useParams, usePathname } from "next/navigation";
import { getVersions } from "@/lib/docs/registry";

export function VersionPicker({ sdk, current }: { sdk: string; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const versions = getVersions(sdk);
  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        // replace /docs/<sdk>/<oldVersion>/... with new version, keep slug
        const parts = pathname.split("/");
        // /docs/react/v0.8.1/hooks/useChat -> docs, react, v0.8.1, ...
        if (parts[3]?.startsWith("v")) parts[3] = `v${v}`;
        else parts.splice(3, 0, `v${v}`);
        router.push(parts.join("/") || `/docs/${sdk}/v${v}`);
      }}
      className="rounded-md border bg-background px-2 py-1 text-xs"
    >
      {versions.map((v) => (
        <option key={v} value={v}>
          {v} {v === versions[0] ? "(latest)" : ""}
        </option>
      ))}
    </select>
  );
}
