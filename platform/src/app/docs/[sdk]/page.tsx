import { redirect } from "next/navigation";
import { getLatest } from "@/lib/docs/registry";

export default async function SdkRedirect({ params }: { params: Promise<{ sdk: string }> }) {
  const { sdk } = await params;
  const latest = getLatest(sdk);
  if (!latest) return <div>SDK not found</div>;
  redirect(`/docs/${sdk}/v${latest}`);
}
