"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogInIcon, RocketIcon, LayoutDashboardIcon } from "lucide-react";

export function DesktopAuthButtons() {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) return null;

  return (
    <>
      {!userId ? (
        <>
          <Button variant="ghost" size="sm" id="sign-in-btn" asChild>
            <Link href="/sign-in">
              <LogInIcon className="size-4" />
              Sign In
            </Link>
          </Button>
          <Button
            size="sm"
            className="glow-primary"
            id="get-started-btn"
            asChild
          >
            <Link href="/sign-up">
              <RocketIcon className="size-4" />
              Get Started
            </Link>
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <LayoutDashboardIcon className="size-4" />
              <span>Dashboard</span>
            </Link>
          </Button>
          <UserButton afterSignOutUrl="/" />
        </div>
      )}
    </>
  );
}

export function MobileAuthButtons({ setOpen }) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) return null;

  return (
    <>
      {!userId ? (
        <>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/sign-in">
              <LogInIcon className="size-4" />
              Sign In
            </Link>
          </Button>
          <Button
            className="w-full justify-start gap-2 glow-primary"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/sign-up">
              <RocketIcon className="size-4" />
              Get Started
            </Link>
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/dashboard">
              <LayoutDashboardIcon className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex w-full items-center justify-between px-3 py-2">
            <span className="text-sm font-medium">Account</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      )}
    </>
  );
}
