"use client";

import * as React from "react";
import Link from "next/link";
import {
  CpuIcon,
  PlugsConnectedIcon,
  WrenchIcon,
  BookOpenIcon,
  ArchiveIcon,
  LightningIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  XIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachItem, attachId } from "./attach-picker";

export type AttachField =
  | "skills"
  | "knowledgeBases"
  | "mcps"
  | "restApiTools"
  | "rcpSources"
  | "storeMounts";

interface CategoryDef {
  id: "all" | AttachField;
  label: string;
  field?: AttachField;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  createPath: string;
  emptyNoun: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "all",
    label: "All",
    icon: WrenchIcon,
    color: "text-foreground",
    bg: "bg-muted",
    createPath: "",
    emptyNoun: "resource",
  },
  {
    id: "skills",
    label: "Skills",
    field: "skills",
    icon: CpuIcon,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    createPath: "/skills/new",
    emptyNoun: "skill",
  },
  {
    id: "knowledgeBases",
    label: "Knowledge",
    field: "knowledgeBases",
    icon: BookOpenIcon,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    createPath: "/knowledge/new",
    emptyNoun: "knowledge base",
  },
  {
    id: "mcps",
    label: "MCP",
    field: "mcps",
    icon: PlugsConnectedIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    createPath: "/mcps/new",
    emptyNoun: "MCP server",
  },
  {
    id: "restApiTools",
    label: "REST Tools",
    field: "restApiTools",
    icon: WrenchIcon,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    createPath: "/rest-tools/new",
    emptyNoun: "REST tool",
  },
  {
    id: "rcpSources",
    label: "RCP Sources",
    field: "rcpSources",
    icon: LightningIcon,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    createPath: "/rcp-sources/new",
    emptyNoun: "RCP source",
  },
  {
    id: "storeMounts",
    label: "Stores",
    field: "storeMounts",
    icon: ArchiveIcon,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    createPath: "/stores/new",
    emptyNoun: "store",
  },
];

interface NormalizedResource {
  id: string;
  field: AttachField;
  name: string;
  meta?: string;
  item: AttachItem;
  def: CategoryDef;
}

export interface ProjectResourcePickerProps {
  projectId: string;
  skills: AttachItem[];
  knowledge: AttachItem[];
  mcps: AttachItem[];
  restTools: AttachItem[];
  rcpSources: AttachItem[];
  stores: AttachItem[];
  loading: boolean;
  selected: Record<AttachField, string[]>;
  onToggle: (field: AttachField, id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ProjectResourcePicker({
  projectId,
  skills,
  knowledge,
  mcps,
  restTools,
  rcpSources,
  stores,
  loading,
  selected,
  onToggle,
  onClearAll,
  className = "",
}: ProjectResourcePickerProps) {
  const [activeTab, setActiveTab] = React.useState<"all" | AttachField>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showAttachedOnly, setShowAttachedOnly] = React.useState(false);
  const [expandedRcp, setExpandedRcp] = React.useState<Record<string, boolean>>(
    {},
  );

  // Flatten all items into unified resources
  const allResources = React.useMemo(() => {
    const list: NormalizedResource[] = [];

    const addGroup = (items: AttachItem[], field: AttachField) => {
      const def = CATEGORIES.find((c) => c.field === field)!;
      for (const item of items) {
        const id = attachId(item);
        if (!id) continue;
        list.push({
          id,
          field,
          name: item.name || "Untitled",
          meta: item.meta,
          item,
          def,
        });
      }
    };

    addGroup(skills, "skills");
    addGroup(knowledge, "knowledgeBases");
    addGroup(mcps, "mcps");
    addGroup(restTools, "restApiTools");
    addGroup(rcpSources, "rcpSources");
    addGroup(stores, "storeMounts");

    return list;
  }, [skills, knowledge, mcps, restTools, rcpSources, stores]);

  // Counts
  const totalSelectedCount = React.useMemo(() => {
    return Object.values(selected).reduce(
      (acc, curr) => acc + (curr?.length || 0),
      0,
    );
  }, [selected]);

  const categoryCounts = React.useMemo(() => {
    return {
      all: allResources.length,
      skills: skills.length,
      knowledgeBases: knowledge.length,
      mcps: mcps.length,
      restApiTools: restTools.length,
      rcpSources: rcpSources.length,
      storeMounts: stores.length,
    };
  }, [allResources, skills, knowledge, mcps, restTools, rcpSources, stores]);

  const selectedCategoryCounts = React.useMemo(() => {
    return {
      skills: selected.skills?.length || 0,
      knowledgeBases: selected.knowledgeBases?.length || 0,
      mcps: selected.mcps?.length || 0,
      restApiTools: selected.restApiTools?.length || 0,
      rcpSources: selected.rcpSources?.length || 0,
      storeMounts: selected.storeMounts?.length || 0,
    };
  }, [selected]);

  // Filtered resources
  const filteredResources = React.useMemo(() => {
    return allResources.filter((res) => {
      if (activeTab !== "all" && res.field !== activeTab) return false;

      const isSel = (selected[res.field] || []).includes(res.id);
      if (showAttachedOnly && !isSel) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = res.name.toLowerCase().includes(q);
        const matchesMeta = res.meta && res.meta.toLowerCase().includes(q);
        return matchesName || matchesMeta;
      }

      return true;
    });
  }, [allResources, activeTab, showAttachedOnly, searchQuery, selected]);

  const activeCategoryDef =
    CATEGORIES.find((c) => c.id === activeTab) || CATEGORIES[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with summary stats */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Tools & Capabilities
            </h3>
            <Badge variant="secondary" className="font-mono text-xs">
              {totalSelectedCount} Attached
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attach Skills, MCP Connectors, REST API tools, RCP Sources,
            Knowledge, and Stores.
          </p>
        </div>

        {totalSelectedCount > 0 && onClearAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs text-muted-foreground hover:text-destructive self-start sm:self-auto"
          >
            Clear all attachments
          </Button>
        )}
      </div>

      {/* Selected summary pills */}
      {totalSelectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-none border border-border bg-muted/20 p-2 text-xs">
          <span className="font-medium text-muted-foreground text-[11px] mr-1">
            Active:
          </span>
          {Object.entries(selectedCategoryCounts).map(([cat, count]) => {
            if (count === 0) return null;
            const def = CATEGORIES.find((c) => c.field === cat);
            const Icon = def?.icon || WrenchIcon;
            return (
              <Badge
                key={cat}
                variant="outline"
                className="gap-1 bg-background text-[11px] font-normal"
              >
                <Icon className="size-3 text-primary" />
                {count} {def?.label || cat}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Tabs & Search controls */}
      <div className="space-y-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "all" | AttachField)}
          className="w-full"
        >
          <TabsList className="h-9 w-full justify-start overflow-x-auto bg-muted/40 p-1 flex-nowrap">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id];
              const selCount =
                cat.id === "all"
                  ? totalSelectedCount
                  : selectedCategoryCounts[cat.field as AttachField] || 0;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="gap-1.5 text-xs shrink-0 data-[state=active]:bg-background"
                >
                  {cat.label}
                  {count > 0 && (
                    <span className="rounded-none bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                      {selCount > 0 ? `${selCount}/${count}` : count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Search input & show attached only */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tools, MCPs, skills, or sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={showAttachedOnly}
              onChange={(e) => setShowAttachedOnly(e.target.checked)}
              className="rounded-none border-muted-foreground/30 text-primary"
            />
            Show attached only ({totalSelectedCount})
          </label>
        </div>
      </div>

      {/* Resource Cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="rounded-none border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {searchQuery || showAttachedOnly
              ? "No resources match your search criteria."
              : `No ${activeCategoryDef.label !== "All" ? activeCategoryDef.label : "resources"} configured in this Project yet.`}
          </p>
          {activeCategoryDef.createPath && (
            <Link
              href={`/projects/${projectId}${activeCategoryDef.createPath}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <PlusIcon className="size-3.5" />
                New {activeCategoryDef.emptyNoun}
                <ArrowRightIcon className="size-3 opacity-60 ml-0.5" />
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filteredResources.map((res) => {
            const isSelected = (selected[res.field] || []).includes(res.id);
            const Icon = res.def.icon;
            const isRcp = res.field === "rcpSources";
            const raw = res.item.raw as Record<string, unknown> | undefined;
            const paramContextMap =
              (raw?.paramContextMap as {
                param: string;
                contextKey: string;
              }[]) || [];
            const isExpanded = !!expandedRcp[res.id];

            return (
              <div
                key={`${res.field}-${res.id}`}
                className={`relative flex flex-col justify-between rounded-none border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/60 shadow-xs"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                {/* Clickable Card Header */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onToggle(res.field, res.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`p-1.5 ${res.def.bg} ${res.def.color} shrink-0`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate text-foreground">
                          {res.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          {res.def.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.meta && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 max-w-[120px] truncate"
                        >
                          {res.meta}
                        </Badge>
                      )}
                      <div
                        className={`flex size-5 items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 bg-background"
                        }`}
                      >
                        {isSelected && (
                          <CheckIcon className="size-3 stroke-[3]" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RCP Source context mapping details */}
                {isRcp && isSelected && (
                  <div className="mt-3 pt-2.5 border-t border-border/60 text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                        <LightningIcon className="size-3 text-amber-500" />
                        {paramContextMap.length > 0
                          ? `${paramContextMap.length} param${paramContextMap.length === 1 ? "" : "s"} resolved from context`
                          : "No context params mapped"}
                      </span>

                      <div className="flex items-center gap-1">
                        <Link
                          href={`/projects/${projectId}/rcp-sources/${res.id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline px-1 py-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Configure
                          <ArrowRightIcon className="size-2.5" />
                        </Link>
                        {paramContextMap.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRcp((prev) => ({
                                ...prev,
                                [res.id]: !prev[res.id],
                              }));
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            {isExpanded ? (
                              <CaretUpIcon className="size-3.5" />
                            ) : (
                              <CaretDownIcon className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && paramContextMap.length > 0 && (
                      <div className="space-y-1 bg-muted/40 p-2 text-[11px] font-mono">
                        {paramContextMap.map((m) => (
                          <div
                            key={m.param}
                            className="flex items-center justify-between gap-1 text-muted-foreground"
                          >
                            <span className="text-foreground font-semibold">
                              {m.param}
                            </span>
                            <span className="text-[10px] text-primary">
                              ← {`{{${m.contextKey}}}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
