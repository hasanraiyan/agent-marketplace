"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogInIcon, RocketIcon } from "lucide-react";

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
        <UserButton />
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
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">Account</span>
          <UserButton />
        </div>
      )}
    </>
  );
}
