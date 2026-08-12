"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  EllipsisVerticalIcon,
  CircleUserRoundIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";

export function NavUser({ user }) {
  const { isMobile } = useSidebar();
  const { signOut, openUserProfile } = useClerk();

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "AI";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 border border-zinc-200/80 bg-white/60 hover:bg-zinc-50 rounded-xl shadow-xs transition-all duration-300 px-3 data-[state=open]:bg-zinc-100/80"
            >
              <Avatar className="h-8.5 w-8.5 rounded-lg border border-zinc-100">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-[#1E60FF]/10 text-[#1E60FF] font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                <span className="truncate text-[13px] font-bold text-zinc-800">
                  {user.name}
                </span>
                <span className="truncate text-[10.5px] text-zinc-400 font-medium">
                  {user.email}
                </span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-3.5 text-zinc-400 hover:text-zinc-600 transition-colors" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl p-1.5 shadow-lg border border-zinc-100"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                <Avatar className="h-8.5 w-8.5 rounded-lg border border-zinc-100">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-[#1E60FF]/10 text-[#1E60FF] font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-[13px] font-bold text-zinc-800">
                    {user.name}
                  </span>
                  <span className="truncate text-[10.5px] text-zinc-400 font-medium">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-zinc-100" />
            <DropdownMenuGroup className="gap-0.5 flex flex-col">
              <DropdownMenuItem
                asChild
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-700"
              >
                <Link href="/dashboard/profile">
                  <UserIcon className="mr-2.5 size-4 text-zinc-400" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openUserProfile()}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-700"
              >
                <CircleUserRoundIcon className="mr-2.5 size-4 text-zinc-400" />
                Identity
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1 bg-zinc-100" />
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <LogOutIcon className="mr-2.5 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
