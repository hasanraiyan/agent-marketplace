import { DashboardHeaderProvider } from "@/components/dashboard-header-context";
import { SiteHeader } from "@/components/site-header";
import { DeveloperSidebar } from "@/components/developer/developer-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { developerRoutes } from "@/lib/developer-routes";

export const metadata = {
  title: "Developer Studio · persona.hasanraiyan.me",
  description:
    "Manage your persona.hasanraiyan.me Developer Platform Projects — members, credentials, and lifecycle.",
};

const DEVELOPER_HEADER_FALLBACK = {
  routeMap: [
    { path: developerRoutes.projectNew, title: "New Project" },
    { path: developerRoutes.projects, title: "Projects" },
    { path: developerRoutes.home, title: "Developer Studio" },
  ],
  title: "Developer Studio",
  action: { href: developerRoutes.projectNew, label: "New Project" },
};

/**
 * Developer Studio shell — the Project-management workspace.
 *
 * A third route tree alongside /dashboard (consumer) and /studio (agent
 * creator), per blueprint §29 — deliberately mirrors studio/layout.js's
 * composition exactly (same sidebar primitives, same shared header
 * context). Auth is handled entirely by the existing global
 * `clerkMiddleware` in src/middleware.js — /developer isn't in its
 * `isPublicRoute` list, so it's already protected with zero new wiring.
 */
export default function DeveloperLayout({ children }) {
  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      }}
      className="h-svh overflow-hidden"
    >
      <DeveloperSidebar variant="inset" />
      <DashboardHeaderProvider>
        <SidebarInset className="min-h-0 overflow-hidden">
          <SiteHeader fallback={DEVELOPER_HEADER_FALLBACK} />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </DashboardHeaderProvider>
    </SidebarProvider>
  );
}
