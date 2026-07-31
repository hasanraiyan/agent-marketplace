import { redirect } from "next/navigation";
import { developerRoutes } from "@/lib/developer-routes";

/**
 * Projects is the only Developer Studio section in v1 — the bare
 * /developer root redirects straight to it rather than duplicating an
 * "Overview" page with nothing on it yet.
 */
export default function DeveloperHomeRedirect() {
  redirect(developerRoutes.projects);
}
