"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const getStartedClass =
  "h-9 rounded-full bg-[#1E60FF] px-5 text-sm font-semibold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:scale-[1.02] hover:bg-[#154ed0] active:scale-[0.98]";
const ghostNavClass =
  "rounded-full px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

export function DesktopAuthButtons() {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) return null;

  return (
    <>
      {!userId ? (
        <>
          <Button variant="ghost" className={ghostNavClass} id="sign-in-btn" asChild>
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
            <span className="text-sm font-medium text-zinc-600">Account</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      )}
    </>
  );
}
