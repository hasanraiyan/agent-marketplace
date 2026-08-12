"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  MenuIcon,
  LayoutGridIcon,
  BookOpenIcon,
  LibraryIcon,
} from "lucide-react";
import {
  DesktopAuthButtons,
  MobileAuthButtons,
} from "@/components/auth-buttons";

const navLinks = [
  { href: "#categories", label: "The Index", icon: LibraryIcon },
  { href: "#how-it-works", label: "How It Works", icon: BookOpenIcon },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGridIcon },
];

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      id="navbar"
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" id="logo-link">
          <span className="size-2 rounded-full bg-[#1E60FF]" />
          <span className="font-display text-lg font-semibold tracking-tight text-zinc-900">
            Persona<span className="text-zinc-400">.ai</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              id={`nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <DesktopAuthButtons />
        </div>

        {/* Mobile Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              id="mobile-menu-btn"
            >
              <MenuIcon />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-72 bg-background/95 backdrop-blur-xl"
          >
            <SheetTitle className="font-display flex items-center gap-2 p-4 text-base">
              <span className="size-2 rounded-full bg-[#1E60FF]" />
              Persona.ai
            </SheetTitle>
            <Separator />
            <div className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <link.icon data-icon="inline-start" />
                  {link.label}
                </Link>
              ))}
            </div>
            <Separator />
            <div className="flex flex-col gap-2 p-4">
              <MobileAuthButtons setOpen={setOpen} />
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
