"use client";

import { SettingsNav } from "@/components/settings/settings-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";
import { useState } from "react";

export default function SettingsLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-muted/30">
        <SettingsNav />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header (only visible on mobile) */}
        <div className="flex md:hidden items-center p-4 border-b bg-background sticky top-0 z-10">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SettingsNav onSelect={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="ml-4 font-semibold">Settings</span>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
