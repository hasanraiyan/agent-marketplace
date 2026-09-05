"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboardIcon, LogOutIcon } from "lucide-react";

const getStartedClass =
  "h-9 rounded-full bg-[#1E60FF] px-5 text-sm font-semibold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:scale-[1.02] hover:bg-[#154ed0] active:scale-[0.98]";
const ghostNavClass =
  "rounded-full px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

function initialsOf(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const name = user?.fullName || user?.username || "Account";
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex size-9 items-center justify-center rounded-full ring-1 ring-zinc-200 transition-all hover:ring-[#1E60FF]/40">
          <Avatar className="size-9">
            <AvatarImage src={user?.imageUrl} alt={name} />
            <AvatarFallback className="bg-[#1E60FF]/10 text-xs font-bold text-[#1E60FF]">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
          {email && (
            <p className="truncate text-xs font-normal text-zinc-500">
              {email}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard">
            <LayoutDashboardIcon className="mr-2 size-4 text-zinc-400" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOutIcon className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DesktopAuthButtons() {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) return null;

  return (
    <>
      {!userId ? (
        <>
          <Button
            variant="ghost"
            className={ghostNavClass}
            id="sign-in-btn"
            asChild
          >
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button className={getStartedClass} id="get-started-btn" asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Button variant="ghost" className={ghostNavClass} asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <UserMenu />
        </div>
      )}
    </>
  );
}

export function MobileAuthButtons({ setOpen }) {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) return null;

  return (
    <>
      {!userId ? (
        <>
          <Button
            variant="ghost"
            className="w-full justify-center rounded-full border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button
            className={`w-full justify-center ${getStartedClass}`}
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="w-full justify-center rounded-full border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <div className="flex w-full items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-zinc-600">
              {user?.fullName || user?.username || "Account"}
            </span>
            <button
              onClick={() => {
                setOpen(false);
                signOut({ redirectUrl: "/" });
              }}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
