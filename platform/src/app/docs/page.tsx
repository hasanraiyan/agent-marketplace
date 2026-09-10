import Link from "next/link";
import { getSdks } from "@/lib/docs/registry";

export default function DocsHome() {
  const sdks = getSdks();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Persona Docs</h1>
      <p className="text-muted-foreground">Versioned per SDK — latest shown, header picker switches. Each feature is its own page, interlinked.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {sdks.map((sdk) => (
          <Link key={sdk.id} href={`/docs/${sdk.id}/v${sdk.latest}`} className="rounded-lg border p-4 hover:bg-accent">
            <div className="font-semibold">{sdk.title} <span className="text-xs font-normal text-muted-foreground">v{sdk.latest} latest</span></div>
            <div className="text-xs text-muted-foreground mt-1">{sdk.description}</div>
            <div className="text-xs mt-2">Versions: {sdk.versions.map(v=>`v${v}`).join(", ")}</div>
          </Link>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">Tracking: <code>content/docs/registry.json</code> + <code>content/docs/_tracking.json</code> updated via <code>node scripts/docs-bump.mjs --sdk=react --version=x.y.z</code></div>
    </div>
  );
}
