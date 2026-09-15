import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { DocsRenderer } from "@/components/docs/docs-renderer";
import type { Metadata } from "next";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";

export async function generateStaticParams() {
  return [];
}

function readConcept(slug: string[]) {
  const base = path.join(process.cwd(), "content", "concepts");
  const tryPaths = [path.join(base, ...slug) + ".mdx", path.join(base, ...slug) + ".md", path.join(base, ...slug, "index.mdx")];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
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
  return (
    <article className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/docs" />}>Docs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/concepts" />}>Concepts</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            concepts/{slug.join("/")}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="text-base text-muted-foreground leading-relaxed">{description}</p>}
      </div>

      <DocsRenderer content={doc.content} />
    </article>
  );
}
