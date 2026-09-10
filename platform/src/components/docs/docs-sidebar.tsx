"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocsNavigation } from "@/lib/docs/mdx";
import { VersionPicker } from "./version-picker";

interface DocsSidebarProps {
  sdk: string;
  version: string;
  sdkTitle: string;
  nav: DocsNavigation;
}

export function DocsSidebar({ sdk, version, sdkTitle, nav }: DocsSidebarProps) {
  const pathname = usePathname();
  const [filter, setFilter] = React.useState("");
  const [isOpenMobile, setIsOpenMobile] = React.useState(false);

  const filteredGroups = React.useMemo(() => {
    if (!filter.trim()) return nav.groups;
    const q = filter.toLowerCase();
    return nav.groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) ||
            item.slug.join(" ").toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [nav.groups, filter]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* SDK Header & Version Selector */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {sdkTitle}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              v{version}
            </span>
          </div>
          <VersionPicker sdk={sdk} current={version} />
        </div>

        {/* Quick Filter Input */}
        <div className="mt-2.5">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search this SDK..."
            className="w-full rounded-md border border-input bg-background/80 px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>
      </div>

      {/* Navigation Tree */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No matching documents found.
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.name} className="space-y-1.5">
              <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{group.name}</span>
                <span className="text-[10px] text-muted-foreground/70">
                  {group.items.length}
                </span>
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.isIndex && pathname === `/docs/${sdk}/v${version}`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsOpenMobile(false)}
                        className={`group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-600 hover:text-white"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Sticky Bar */}
      <div className="sticky top-14 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        <button
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span>Menu</span>
        </button>
        <span className="text-xs font-semibold">{sdkTitle}</span>
        <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
          v{version}
        </span>
      </div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsOpenMobile(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-background shadow-xl border-r">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r bg-background/50 backdrop-blur md:block">
        {sidebarContent}
      </aside>
    </>
  );
}
