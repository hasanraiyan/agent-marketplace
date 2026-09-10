import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/docs" className="font-semibold">
            Persona Docs
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/docs/react/v0.8.1" className="hover:text-foreground">
              React
            </Link>
            <Link href="/docs/adapters/v0.1.0" className="hover:text-foreground">
              Adapters
            </Link>
            <Link href="/docs/runtime/v0.9.5" className="hover:text-foreground">
              Runtime
            </Link>
          </nav>
          <div className="text-xs text-muted-foreground">Version picker in page →</div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
