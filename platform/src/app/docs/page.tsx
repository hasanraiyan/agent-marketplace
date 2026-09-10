import Link from "next/link";
import { getSdks } from "@/lib/docs/registry";

export default function DocsHome() {
  const sdks = getSdks();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-xs">
          Persona Platform Docs
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Documentation
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
          Comprehensive guides, route references, and architecture blueprints for Persona SDKs and runtimes.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {sdks.map((sdk) => (
          <Link
            key={sdk.id}
            href={`/docs/${sdk.id}/v${sdk.latest}`}
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs transition-all hover:border-blue-600 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-bold text-foreground group-hover:text-blue-600 transition-colors">
                  {sdk.title}
                </span>
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  v{sdk.latest}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {sdk.description}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
              <span className="text-muted-foreground font-mono">
                {sdk.versions.length} version{sdk.versions.length > 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                Read docs →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
