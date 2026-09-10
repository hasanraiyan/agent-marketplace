import registry from "../../../content/docs/registry.json";

export type SdkId = string;
export interface SdkEntry { id: string; title: string; description: string; latest: string; versions: string[]; }

export function getSdks(): SdkEntry[] { return (registry as any).sdks; }
export function getSdk(id: string): SdkEntry | undefined { return getSdks().find(s => s.id === id); }
export function getVersions(sdk: string): string[] { return getSdk(sdk)?.versions ?? []; }
export function getLatest(sdk: string): string | undefined { return getSdk(sdk)?.latest; }
export function resolveVersion(sdk: string, requested?: string): string | undefined {
  const versions = getVersions(sdk);
  if (!requested || requested === "latest") return getLatest(sdk);
  const v = requested.startsWith("v") ? requested.slice(1) : requested;
  return versions.includes(v) ? v : undefined;
}
