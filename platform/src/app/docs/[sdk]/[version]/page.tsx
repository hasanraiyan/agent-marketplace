import { notFound } from "next/navigation";
import { readDoc } from "@/lib/docs/mdx";
import { VersionPicker } from "@/components/docs/version-picker";
import Link from "next/link";

export default async function VersionIndex({ params }: { params: Promise<{ sdk: string; version: string }> }) {
  const { sdk, version } = await params;
  const v = version.replace(/^v/, "");
  const doc = readDoc(sdk, v, []);
  if (!doc) return notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{doc.meta.title}</h1>
          {doc.meta.description && <p className="text-sm text-muted-foreground">{doc.meta.description}</p>}
        </div>
        <VersionPicker sdk={sdk} current={v} />
      </div>
      <div className="rounded-lg border p-4">
        <pre className="whitespace-pre-wrap text-sm">{doc.content.slice(0, 4000)}</pre>
        <div className="mt-4 flex gap-2 text-xs">
          <Link href={`/docs/${sdk}/v${v}/quickstart`} className="underline">Quickstart</Link>
          <Link href={`/docs/${sdk}/v${v}/hooks/useChat`} className="underline">useChat</Link>
          <Link href={`/docs/${sdk}/v${v}/types`} className="underline">Types</Link>
        </div>
        {doc.meta.related && (
          <div className="mt-4 text-xs">Related: {doc.meta.related.join(", ")}</div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">Interlinked pages per feature — this is v{v} latest. Use header picker to switch to v0.8.0 etc. Tracking via <code>registry.json</code> + <code>_tracking.json</code>.</div>
    </div>
  );
}
