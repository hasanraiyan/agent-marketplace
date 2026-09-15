"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { DocsNavigation } from "@/lib/docs/mdx";
import { VersionPicker } from "./version-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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
      <div className="space-y-2.5 p-4">
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
        <InputGroup className="h-8 bg-background">
          <InputGroupAddon align="inline-start">
            <MagnifyingGlassIcon className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search this SDK..."
            className="text-xs"
          />
        </InputGroup>
      </div>

      <Separator />

      {/* Navigation Tree */}
      <ScrollArea className="flex-1 px-3 py-4">
        {filteredGroups.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            No matching documents found.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.name} className="space-y-1.5">
                <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{group.name}</span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] font-normal text-muted-foreground"
                  >
                    {group.items.length}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.isIndex && pathname === `/docs/${sdk}/v${version}`);

                    return (
                      <Button
                        key={item.href}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={
                          isActive
                            ? "w-full justify-start text-xs font-semibold text-foreground shadow-xs"
                            : "w-full justify-start text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        }
                        render={
                          <Link
                            href={item.href}
                            onClick={() => setIsOpenMobile(false)}
                          />
                        }
                      >
                        <span className="truncate">{item.title}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* Mobile Sticky Bar */}
      <div className="sticky top-14 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpenMobile(true)}
          className="gap-2 text-xs"
        >
          <ListIcon className="size-3.5" />
          <span>Menu</span>
        </Button>
        <span className="text-xs font-semibold">{sdkTitle}</span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          v{version}
        </Badge>
      </div>

      {/* Mobile Drawer */}
      <Sheet open={isOpenMobile} onOpenChange={setIsOpenMobile}>
        <SheetContent side="left" className="w-72 max-w-[80vw] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{sdkTitle} Navigation</SheetTitle>
            <SheetDescription>Navigation links for {sdkTitle}</SheetDescription>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sticky Sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r bg-background/50 backdrop-blur md:block">
        {sidebarContent}
      </aside>
    </>
  );
}
