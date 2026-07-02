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
  CreditCardIcon,
  BellIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";

export function NavUser({ user }) {
  const { isMobile } = useSidebar();
  const { signOut, openUserProfile } = useClerk();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 border border-slate-150/80 bg-white/60 hover:bg-slate-50 dark:border-slate-850/60 dark:bg-[#121214]/40 dark:hover:bg-[#151518]/90 rounded-xl shadow-xs transition-all duration-300 px-3 data-[state=open]:bg-slate-100/80 dark:data-[state=open]:bg-[#18181b]"
            >
              <Avatar className="h-8.5 w-8.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                  {user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "AI"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                <span className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  {user.name}
                </span>
                <span className="truncate text-[10.5px] text-slate-450 dark:text-slate-500 font-medium">
                  {user.email}
                </span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-3.5 text-slate-450 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350 transition-colors" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl p-1.5 shadow-lg border border-slate-100 dark:border-slate-800"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                <Avatar className="h-8.5 w-8.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    {user.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "AI"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">{user.name}</span>
                  <span className="truncate text-[10.5px] text-slate-450 dark:text-slate-500 font-medium">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
            <DropdownMenuGroup className="gap-0.5 flex flex-col">
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Link href="/dashboard/profile">
                  <UserIcon className="mr-2.5 size-4 text-slate-450 dark:text-slate-500" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openUserProfile()}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <CircleUserRoundIcon className="mr-2.5 size-4 text-slate-450 dark:text-slate-500" />
                Identity
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <CreditCardIcon className="mr-2.5 size-4 text-slate-450 dark:text-slate-500" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <BellIcon className="mr-2.5 size-4 text-slate-450 dark:text-slate-500" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-bold text-red-650 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
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
