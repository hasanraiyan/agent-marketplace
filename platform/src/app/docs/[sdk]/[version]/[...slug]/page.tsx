import { notFound } from "next/navigation";
import { readDoc, listDocs } from "@/lib/docs/mdx";
import { VersionPicker } from "@/components/docs/version-picker";

export async function generateStaticParams() {
  // minimal — allow dynamic
  return [];
}

export default async function DocPage({ params }: { params: Promise<{ sdk: string; version: string; slug: string[] }> }) {
  const { sdk, version, slug } = await params;
  const v = version.replace(/^v/, "");
  const doc = readDoc(sdk, v, slug);
  if (!doc) return notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{sdk} v{v} / {slug.join("/") || "index"}</div>
        <VersionPicker sdk={sdk} current={v} />
      </div>
      <h1 className="text-2xl font-bold">{doc.meta.title}</h1>
      {doc.meta.description && <p className="text-sm text-muted-foreground">{doc.meta.description}</p>}
      <article className="prose max-w-none prose-sm dark:prose-invert rounded-lg border p-4">
        <pre className="whitespace-pre-wrap text-sm">{doc.content}</pre>
      </article>
      <div className="flex justify-between text-xs">
        {doc.meta.prev ? <a href={doc.meta.prev} className="underline">← Prev</a> : <span />}
        {doc.meta.next ? <a href={doc.meta.next} className="underline">Next →</a> : <span />}
      </div>
    </div>
  );
}
