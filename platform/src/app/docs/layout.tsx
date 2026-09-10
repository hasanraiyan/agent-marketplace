import Link from "next/link";
import { DocsHeaderNav } from "@/components/docs/docs-header-nav";

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
            <Link
              href="/projects"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Console →
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
