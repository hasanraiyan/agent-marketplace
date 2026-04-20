"use client";

import * as React from "react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUser } from "@clerk/nextjs";
import {
  ZapIcon,
  ActivityIcon,
  CpuIcon,
  BrainIcon,
  LayersIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  DatabaseIcon,
  FileIcon,
  CameraIcon,
  FileTextIcon,
  SparklesIcon,
} from "lucide-react";

const data = {
  // user removed in favor of dynamic clerk data
  navMain: [
    {
      title: "Intelligence",
      url: "#",
      icon: <BrainIcon />,
    },
    {
      title: "Agent Ops",
      url: "#",
      icon: <ActivityIcon />,
    },
    {
      title: "Insights",
      url: "#",
      icon: <ActivityIcon />,
    },
    {
      title: "Deployments",
      url: "#",
      icon: <LayersIcon />,
    },
    {
      title: "Orchestrators",
      url: "#",
      icon: <CpuIcon />,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: <CameraIcon />,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ],
  documents: [
    {
      name: "Agent Skills",
      url: "#",
      icon: <ZapIcon />,
    },
    {
      name: "Knowledge Base",
      url: "#",
      icon: <DatabaseIcon />,
    },
    {
      name: "Training Data",
      url: "#",
      icon: <FileIcon />,
    },
  ],
};

export function AppSidebar({ ...props }) {
  const { user } = useUser();
  const userData = {
    name: user?.fullName || "Guest User",
    email: user?.primaryEmailAddress?.emailAddress || "",
    avatar: user?.imageUrl || "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <SparklesIcon className="size-5! text-primary" />
                <span className="text-base font-bold tracking-tight">
                  Persona<span className="text-primary">.ai</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
