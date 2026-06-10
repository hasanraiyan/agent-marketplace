import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeaderProvider } from "@/components/dashboard-header-context";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ThreadsProvider } from "@/components/threads-context";

export default function DashboardLayout({ children }) {
  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      }}
    >
      {/* ThreadsProvider wraps the whole dashboard so sidebar and pages
          share ONE fetch, ONE state, ONE refresh() signal */}
      <ThreadsProvider>
        <AppSidebar variant="inset" />
        <DashboardHeaderProvider>
          <SidebarInset className="min-h-0 overflow-hidden">
            <SiteHeader />
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </SidebarInset>
        </DashboardHeaderProvider>
      </ThreadsProvider>
    </SidebarProvider>
  );
}
