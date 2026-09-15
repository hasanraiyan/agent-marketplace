import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

function readConcept(slug: string[]) {
  const base = path.join(process.cwd(), "content", "concepts");
  const tryPaths = [path.join(base, ...slug) + ".mdx", path.join(base, ...slug) + ".md", path.join(base, ...slug, "index.mdx")];
  for (const p of tryPaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ p, "utf8");
      const { data, content } = matter(raw);
      return { data, content, path: p };
    }
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug = [] } = await params;
  const doc = readConcept(slug);
  if (!doc) return {};
  const title = (doc.data.title as string) || slug[slug.length - 1] || "Concepts";
  const description = doc.data.description as string | undefined;
  const url = `/concepts/${slug.join("/")}`;
  return {
    title: `${title} — Persona Concepts`,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
  };
}

export default async function ConceptPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const doc = readConcept(slug);
  if (!doc) return notFound();
  const title = (doc.data.title as string) || slug[slug.length - 1] || "Concepts";
  const description = doc.data.description as string | undefined;
  // Render markdown as plain pre for now to avoid client DocsRenderer createContext mismatch during sitemap collection;
  // will be upgraded to DocsRenderer once build is green.
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed">
        {doc.content}
      </pre>
    </article>
  );
}
