import Link from "next/link";
import type { Metadata } from "next";
import { getSdks } from "@/lib/docs/registry";

export const metadata: Metadata = {
  title: "Documentation — Persona Platform",
  description: "Guides, route references, and architecture blueprints for Persona SDKs and runtimes.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Persona Platform Docs",
    description: "Guides, route references, and architecture blueprints for Persona SDKs and runtimes.",
    url: "/docs",
  },
};
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function DocsHome() {
  const sdks = getSdks();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
      <div className="space-y-3">
        <Badge variant="secondary" className="px-3 py-1 text-xs">
          Persona Platform Docs
        </Badge>
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
            className="group block"
          >
            <Card className="h-full transition-all hover:bg-muted/40 hover:ring-1 hover:ring-border">
              <CardHeader className="space-y-3 p-6">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-mono text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {sdk.title}
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    v{sdk.latest}
                  </Badge>
                </div>
                <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                  {sdk.description}
                </CardDescription>
              </CardHeader>

              <Separator className="opacity-60" />

              <CardFooter className="flex items-center justify-between p-4 text-xs">
                <span className="text-muted-foreground font-mono">
                  {sdk.versions.length} version{sdk.versions.length > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 font-medium text-foreground group-hover:translate-x-0.5 transition-transform">
                  Read docs →
                </span>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
