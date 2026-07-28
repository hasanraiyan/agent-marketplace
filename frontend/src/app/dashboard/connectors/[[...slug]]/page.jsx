import { redirect } from "next/navigation";
import {
  LEGACY_CONNECTOR_SECTIONS,
  studioRoutes,
} from "@/lib/studio-routes";

/**
 * Compatibility redirect for the pre-Studio connector routes.
 *
 * /dashboard/connectors                    → /studio
 * /dashboard/connectors/skills/:rest       → /studio/skills/:rest
 * /dashboard/connectors/knowledge/:rest    → /studio/knowledge/:rest
 * /dashboard/connectors/mcps/:rest         → /studio/connectors/:rest
 * /dashboard/connectors/memory             → /studio/memory
 *
 * Query strings are preserved so the MCP OAuth callback
 * (?mcpId=…&connected=…) still lands on the right server.
 */
export default async function LegacyConnectorsRedirect({
  params,
  searchParams,
}) {
  const { slug = [] } = await params;
  const query = new URLSearchParams(await searchParams).toString();
  const suffix = query ? `?${query}` : "";

  const [section, ...rest] = slug;
  const studioSection = LEGACY_CONNECTOR_SECTIONS[section];

  if (!studioSection) {
    redirect(studioRoutes.home);
  }

  redirect(["/studio", studioSection, ...rest].join("/") + suffix);
}
