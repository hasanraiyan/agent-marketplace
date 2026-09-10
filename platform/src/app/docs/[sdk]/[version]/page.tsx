import { notFound } from "next/navigation";
import { readDoc, getDocsNavigation } from "@/lib/docs/mdx";
import { DocsRenderer } from "@/components/docs/docs-renderer";
import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { DocsPager } from "@/components/docs/docs-pager";

export default async function VersionIndex({
  params,
}: {
  params: Promise<{ sdk: string; version: string }>;
}) {
  const { sdk, version } = await params;
  const v = version.replace(/^v/, "");
  const doc = readDoc(sdk, v, []);

  if (!doc) return notFound();

  const nav = getDocsNavigation(sdk, v);
  const currentHref = `/docs/${sdk}/v${v}`;
  const currIdx = nav.flatItems.findIndex(
    (item) => item.href === currentHref || item.isIndex
  );

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
        slug={[]}
        title={doc.meta.title}
      />

      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            {sdk} v{v}
          </span>
        </div>
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
