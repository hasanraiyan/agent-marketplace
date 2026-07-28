import { DashboardHeaderProvider } from "@/components/dashboard-header-context";
import { SiteHeader } from "@/components/site-header";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { studioRoutes } from "@/lib/studio-routes";

export const metadata = {
  title: "Agent Studio · Persona.ai",
  description: "Build, configure, test, and publish your Persona.ai agents.",
};

const STUDIO_HEADER_FALLBACK = {
  routeMap: [
    { path: studioRoutes.agentNew, title: "New Agent" },
    { path: studioRoutes.agents, title: "Agents" },
    { path: studioRoutes.skills, title: "Skills" },
    { path: studioRoutes.knowledge, title: "Knowledge" },
    { path: studioRoutes.connectors, title: "Connectors" },
    { path: studioRoutes.memory, title: "Memory" },
    { path: studioRoutes.providers, title: "Providers" },
    { path: studioRoutes.home, title: "Agent Studio" },
  ],
  title: "Agent Studio",
  action: { href: studioRoutes.agentNew, label: "New Agent" },
};

/**
 * Agent Studio shell — the creator workspace.
 *
 * Deliberately mirrors the dashboard shell (same sidebar primitives, same
 * shared header context, same auth) so both experiences stay one application;
 * only the navigation and information architecture differ. Studio does not
 * mount ThreadsProvider: conversation history belongs to the consumer surface.
 */
export default function StudioLayout({ children }) {
  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      }}
      className="h-svh overflow-hidden"
    >
      <StudioSidebar variant="inset" />
      <DashboardHeaderProvider>
        <SidebarInset className="min-h-0 overflow-hidden">
          <SiteHeader fallback={STUDIO_HEADER_FALLBACK} />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </DashboardHeaderProvider>
    </SidebarProvider>
  );
}
