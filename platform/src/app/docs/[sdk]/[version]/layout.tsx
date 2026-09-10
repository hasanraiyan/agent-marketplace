import { notFound } from "next/navigation";
import { getDocsNavigation } from "@/lib/docs/mdx";
import { getSdk } from "@/lib/docs/registry";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default async function SdkVersionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sdk: string; version: string }>;
}) {
  const { sdk, version } = await params;
  const v = version.replace(/^v/, "");
  const sdkMeta = getSdk(sdk);

  if (!sdkMeta) {
    return notFound();
  }

  const nav = getDocsNavigation(sdk, v);

  return (
    <div className="flex w-full items-start">
      <DocsSidebar
        sdk={sdk}
        version={v}
        sdkTitle={sdkMeta.title}
        nav={nav}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-12 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
