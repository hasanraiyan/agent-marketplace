import Link from "next/link";
import { DocsHeaderNav } from "@/components/docs/docs-header-nav";
import { GlobalSearch } from "@/components/docs/global-search";
import { Button } from "@/components/ui/button";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
                P
              </span>
              <span>Persona Docs</span>
            </Link>
            <DocsHeaderNav />
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearch />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              render={<Link href="/projects" />}
            >
              Console →
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
