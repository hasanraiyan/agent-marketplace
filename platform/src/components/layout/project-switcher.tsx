"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CaretUpDownIcon, CheckIcon, FoldersIcon, PlusIcon } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { getProjects } from "@/lib/api/projects";

interface Project {
  _id: string;
  name: string;
}

/**
 * The single entry point for changing which Project's resources the
 * sidebar below it points at — every nav link is relative to this
 * project, so switching here is how you leave one project's Agents/RCP
 * Sources/etc. and land on another's.
 */
function ProjectSwitcher({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[] | null>(null);

  const loadProjects = React.useCallback(() => {
    if (projects) return;
    getProjects()
      .then((res) => setProjects(res.data?.data || []))
      .catch(() => setProjects([]));
  }, [projects]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => open && loadProjects()}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
                  <FoldersIcon className="size-3.5" />
                </div>
                <span className="flex-1 truncate text-left font-medium">{projectName}</span>
                <CaretUpDownIcon className="ml-auto size-3.5 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
            {projects === null ? (
              <DropdownMenuItem disabled>Loading projects…</DropdownMenuItem>
            ) : projects.length === 0 ? (
              <DropdownMenuItem disabled>No other projects</DropdownMenuItem>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem
                  key={project._id}
                  onClick={() => router.push(`/projects/${project._id}`)}
                >
                  {project._id === projectId && <CheckIcon className="size-3.5" />}
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/projects")}>
              <FoldersIcon className="size-3.5" />
              All projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/projects/new")}>
              <PlusIcon className="size-3.5" />
              New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export { ProjectSwitcher };
