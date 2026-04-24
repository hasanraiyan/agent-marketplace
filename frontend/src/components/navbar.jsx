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
  SparklesIcon,
  LayoutGridIcon,
  BookOpenIcon,
  DollarSignIcon,
} from "lucide-react";
import {
  DesktopAuthButtons,
  MobileAuthButtons,
} from "@/components/auth-buttons";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGridIcon },
  { href: "#how-it-works", label: "How It Works", icon: BookOpenIcon },
  { href: "#pricing", label: "Pricing", icon: DollarSignIcon },
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
          ? "glass-strong shadow-lg shadow-black/20"
          : "glass shadow-sm border-b border-white/5"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          id="logo-link"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 transition-all group-hover:bg-primary/25 group-hover:ring-primary/50 group-hover:shadow-lg group-hover:shadow-primary/20">
            <SparklesIcon className="size-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Persona<span className="gradient-text">.ai</span>
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
            <SheetTitle className="flex items-center gap-2 p-4">
              <SparklesIcon className="size-5 text-primary" />
              <span className="font-semibold">Persona.ai</span>
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
