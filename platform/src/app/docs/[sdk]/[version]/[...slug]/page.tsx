import { notFound } from "next/navigation";
import { readDoc, getDocsNavigation } from "@/lib/docs/mdx";
import { DocsRenderer } from "@/components/docs/docs-renderer";
import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { DocsPager } from "@/components/docs/docs-pager";

export async function generateStaticParams() {
  return [];
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ sdk: string; version: string; slug: string[] }>;
}) {
  const { sdk, version, slug } = await params;
  const v = version.replace(/^v/, "");
  const doc = readDoc(sdk, v, slug);

  if (!doc) return notFound();

  const nav = getDocsNavigation(sdk, v);
  const currentHref = `/docs/${sdk}/v${v}/${slug.join("/")}`;
  const currIdx = nav.flatItems.findIndex((item) => item.href === currentHref);

  const prev = currIdx > 0 ? nav.flatItems[currIdx - 1] : null;
  const next =
    currIdx >= 0 && currIdx < nav.flatItems.length - 1
      ? nav.flatItems[currIdx + 1]
      : null;

  return (
    <article className="space-y-6">
      <DocsBreadcrumbs
        sdk={sdk}
        version={v}
        slug={slug}
        title={doc.meta.title}
      />

      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {doc.meta.title}
        </h1>
        {doc.meta.description && (
          <p className="text-base text-muted-foreground leading-relaxed">
            {doc.meta.description}
          </p>
        )}
      </div>

      <DocsRenderer content={doc.content} />

      <DocsPager prev={prev} next={next} />
    </article>
  );
}
