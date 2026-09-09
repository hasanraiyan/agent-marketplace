"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HeaderSlotElements {
  left: HTMLDivElement | null;
  right: HTMLDivElement | null;
}

const HeaderSlotContext = React.createContext<HeaderSlotElements>({ left: null, right: null });

/**
 * The one header shared by every /projects/[projectId]/* page. Wraps the
 * page content too so a page can portal controls into its left/right slots
 * (via HeaderSlot) instead of rendering a second header row of its own.
 */
export function ProjectHeader({ children }: { children: React.ReactNode }) {
  const [left, setLeft] = React.useState<HTMLDivElement | null>(null);
  const [right, setRight] = React.useState<HTMLDivElement | null>(null);

  return (
    <HeaderSlotContext.Provider value={{ left, right }}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <div ref={setLeft} className="flex min-w-0 flex-1 items-center gap-2" />
        <div ref={setRight} className="flex shrink-0 items-center gap-2" />
      </header>
      {children}
    </HeaderSlotContext.Provider>
  );
}

/** Portals `children` into the shared ProjectHeader's left or right slot. */
export function HeaderSlot({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  const el = React.useContext(HeaderSlotContext)[side];
  if (!el) return null;
  return createPortal(children, el);
}
