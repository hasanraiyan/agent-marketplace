"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  UserIcon,
  PaletteIcon,
  CpuIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Account",
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: UserIcon,
        href: "/dashboard/settings/profile",
        keywords: ["name", "avatar", "email", "age", "account"],
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: PaletteIcon,
        href: "/dashboard/settings/appearance",
        keywords: ["theme", "dark", "light", "color"],
      },
    ],
  },
  {
    // Provider API keys are creator configuration and now live in Agent
    // Studio. The entry stays searchable here so people who look for it in
    // settings still find their way there.
    label: "Creator",
    items: [
      {
        id: "providers",
        label: "AI Providers",
        icon: CpuIcon,
        href: studioRoutes.providers,
        keywords: ["api key", "openai", "model", "base url", "provider", "llm"],
      },
      {
        id: "studio",
        label: "Agent Studio",
        icon: SlidersHorizontalIcon,
        href: studioRoutes.home,
        keywords: ["build", "create", "agent", "skills", "knowledge", "mcp"],
      },
    ],
  },
  {
    label: "Data",
    items: [
      {
        id: "danger",
        label: "Danger Zone",
        icon: Trash2Icon,
        href: "/dashboard/settings/danger",
        keywords: ["delete", "threads", "conversations", "history", "clear"],
        className:
          "text-destructive hover:text-destructive hover:bg-destructive/10",
      },
    ],
  },
];

export function SettingsNav({ onSelect }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredGroups = useMemo(() => {
    if (!debouncedQuery) return NAV_GROUPS;

    const lowerQuery = debouncedQuery.toLowerCase();
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.keywords.some((k) => k.includes(lowerQuery)),
      ),
    })).filter((group) => group.items.length > 0);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
      }
      if (e.key === "Enter" && debouncedQuery && filteredGroups.length > 0) {
        const firstItem = filteredGroups[0].items[0];
        if (firstItem) {
          router.push(firstItem.href);
          onSelect?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debouncedQuery, filteredGroups, router, onSelect]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search settings..."
            className="pl-9 pr-8 h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0 px-2">
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onSelect}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      item.className,
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No settings found for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
