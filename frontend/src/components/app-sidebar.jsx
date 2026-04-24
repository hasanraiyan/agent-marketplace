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
  CompassIcon,
  BrainIcon,
  Settings2Icon,
  CircleHelpIcon,
  SparklesIcon,
  MessageSquareIcon,
} from "lucide-react";

const data = {
  // user removed in favor of dynamic clerk data
  navMain: [
    {
      title: "Explore",
      url: "/dashboard",
      icon: <CompassIcon />,
    },
    {
      title: "My Agents",
      url: "/dashboard/agents",
      icon: <BrainIcon />,
    },
    {
      title: "Chats",
      url: "/dashboard/chats",
      icon: <MessageSquareIcon />,
    },
    {
      title: "Marketplace",
      url: "/agents",
      icon: <ZapIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Help & Docs",
      url: "#",
      icon: <CircleHelpIcon />,
    },
  ],
  documents: [],
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
