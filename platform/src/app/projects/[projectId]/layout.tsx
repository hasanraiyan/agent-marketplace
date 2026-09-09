import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ProjectHeader } from "@/components/layout/project-header";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <SidebarProvider>
      <AppSidebar projectId={projectId} />
      <SidebarInset className="h-svh overflow-hidden">
        <ProjectHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </ProjectHeader>
      </SidebarInset>
    </SidebarProvider>
  );
}
