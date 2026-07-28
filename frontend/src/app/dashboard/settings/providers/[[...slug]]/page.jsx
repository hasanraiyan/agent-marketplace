import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

/**
 * Provider management moved into Agent Studio — a marketplace consumer never
 * needs to think about API keys. Old settings deep links keep resolving:
 *
 * /dashboard/settings/providers            → /studio/providers
 * /dashboard/settings/providers/new        → /studio/providers/new
 * /dashboard/settings/providers/:id/edit   → /studio/providers/:id/edit
 */
export default async function LegacyProvidersRedirect({ params }) {
  const { slug = [] } = await params;
  redirect([studioRoutes.providers, ...slug].join("/"));
}
