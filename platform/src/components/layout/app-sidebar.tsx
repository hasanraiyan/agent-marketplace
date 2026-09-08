"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ChatCircleIcon,
  ClockCounterClockwiseIcon,
  CpuIcon,
  DatabaseIcon,
  GearIcon,
  HammerIcon,
  KeyIcon,
  LockKeyIcon,
  BookOpenIcon,
  PlugsConnectedIcon,
  RobotIcon,
  SparkleIcon,
  UsersThreeIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { getProject } from "@/lib/api/projects";
import { useProfile } from "@/hooks/use-profile";
import { getCached, setCached, dedupedFetch, cacheKey } from "@/lib/cache";

// Flat, one level deep — every Project resource is a direct sidebar link,
// not a tab buried inside an overview page. This is the actual fix for
// "worst UX I've ever seen": today reaching Agents is Projects list ->
// open project -> click the Agents tab; here it's one click from anywhere
// in the project.
const NAV_GROUPS = [
  {
    label: "Build",
    items: [
      { segment: "playground", label: "Playground", icon: ChatCircleIcon },
      { segment: "agents", label: "Agents", icon: RobotIcon },
    ],
  },
  {
    label: "Tools",
    items: [
      // REST Tools (no-code, built one-off here) is the project's own tool
      // builder; MCP + RCP Sources are external tool servers it connects to.
      { segment: "rest-tools", label: "REST Tools", icon: HammerIcon },
      { segment: "mcps", label: "MCP", icon: PlugsConnectedIcon },
      { segment: "rcp-sources", label: "RCP Sources", icon: WrenchIcon },
    ],
  },
  {
    label: "Resources",
    items: [
      // The agent-buildable content an Agent actually loads/runs against —
      // everything connection/access related lives under Manage instead.
      { segment: "knowledge", label: "Knowledge", icon: BookOpenIcon },
      { segment: "stores", label: "Stores", icon: DatabaseIcon },
      { segment: "skills", label: "Skills", icon: SparkleIcon },
    ],
  },
  {
    label: "Manage",
    items: [
      // Project governance — the people who administer it, what it's wired
      // to (model providers), the machine-access surface (minted credentials
      // + the secret values they reference), and the lifecycle audit trail.
      { segment: "members", label: "Members", icon: UsersThreeIcon },
      { segment: "providers", label: "Providers", icon: CpuIcon },
      { segment: "credentials", label: "Credentials", icon: KeyIcon },
      { segment: "secrets", label: "Secrets", icon: LockKeyIcon },
      { segment: "audit-logs", label: "Audit Logs", icon: ClockCounterClockwiseIcon },
      { segment: "settings", label: "Settings", icon: GearIcon },
    ],
  },
];

function AppSidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { user } = useProfile();
  const [projectName, setProjectName] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const key = cacheKey.project(projectId);
    const cached = getCached<{ name?: string }>(key);
    if (cached?.name) setProjectName(cached.name);

    dedupedFetch(key, () => getProject(projectId).then((res) => res.data?.data))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setCached(key, data);
          setProjectName(data.name || "Project");
        }
      })
      .catch(() => {
        if (!cancelled && !cached) setProjectName("Project");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const basePath = `/projects/${projectId}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <ProjectSwitcher projectId={projectId} projectName={projectName ?? "Loading…"} />
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const href = `${basePath}/${item.segment}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton isActive={active} tooltip={item.label} render={<Link href={href} />}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
              {/* Clerk v7 removed the afterSignOutUrl prop from UserButton.
                  proxy.ts already routes every signed-out request to /sign-in,
                  so sign-out lands the user there automatically. */}
              <UserButton />
              <span className="truncate text-xs text-muted-foreground">
                {user?.email || user?.username || ""}
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export { AppSidebar };
