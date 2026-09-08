"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CaretUpDownIcon, CheckIcon, FoldersIcon, PlusIcon } from "@phosphor-icons/react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { getProjects } from "@/lib/api/projects";
import { getCached, setCached, dedupedFetch, cacheKey } from "@/lib/cache";

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
    const key = cacheKey.projects();
    const cached = getCached<Project[]>(key);
    if (cached) {
      if (!projects) setProjects(cached);
      // Revalidate in background without flashing loading
      dedupedFetch(key, () => getProjects().then((r) => r.data?.data || []))
        .then((data) => {
          setCached(key, data);
          setProjects(data);
        })
        .catch(() => {});
      return;
    }
    if (projects) return;
    dedupedFetch(key, () => getProjects().then((res) => res.data?.data || []))
      .then((data) => {
        setCached(key, data);
        setProjects(data);
      })
      .catch(() => setProjects([]));
  }, [projects]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => open && loadProjects()}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="border border-transparent hover:border-border data-popup-open:border-border data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:justify-center!"
              >
                <FoldersIcon weight="fill" className="size-4 shrink-0 text-primary" />
                <span className="flex-1 truncate text-left font-medium group-data-[collapsible=icon]:hidden">
                  {projectName}
                </span>
                <CaretUpDownIcon className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="w-64 p-1">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider">
                Projects
              </DropdownMenuLabel>
              {projects === null ? (
                <DropdownMenuItem disabled>Loading projects…</DropdownMenuItem>
              ) : projects.length === 0 ? (
                <DropdownMenuItem disabled>No other projects</DropdownMenuItem>
              ) : (
                projects.map((project) => {
                  const isCurrent = project._id === projectId;
                  return (
                    <DropdownMenuItem
                      key={project._id}
                      onClick={() => router.push(`/projects/${project._id}`)}
                      className={cn("gap-2.5", isCurrent && "bg-accent/40 focus:bg-accent")}
                    >
                      <FoldersIcon
                        className={cn(
                          "size-3.5 shrink-0",
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className={cn("flex-1 truncate", isCurrent && "font-medium")}>
                        {project.name}
                      </span>
                      {isCurrent && (
                        <CheckIcon className="size-3.5 shrink-0 text-primary" weight="bold" />
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/projects")} className="gap-2.5">
                <FoldersIcon className="size-3.5 shrink-0 text-muted-foreground" />
                All projects
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/projects/new")} className="gap-2.5">
                <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                New project
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export { ProjectSwitcher };