"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Cpu,
  Plug,
  Wrench,
  Globe,
  Waypoints,
  Database,
  Boxes,
  Check,
  Search,
  ExternalLink,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { developerRoutes } from "@/lib/developer-routes";

const CATEGORIES = [
  { id: "all", label: "All Resources" },
  { id: "skills", label: "Skills", icon: Cpu, field: "skills" },
  { id: "mcps", label: "MCP Connectors", icon: Plug, field: "mcps" },
  {
    id: "restApiTools",
    label: "REST Tools",
    icon: Wrench,
    field: "restApiTools",
  },
  {
    id: "restApiToolSources",
    label: "REST Sources",
    icon: Globe,
    field: "restApiToolSources",
  },
  {
    id: "rcpSources",
    label: "RCP Sources",
    icon: Waypoints,
    field: "rcpSources",
  },
  {
    id: "knowledgeBases",
    label: "Knowledge",
    icon: Database,
    field: "knowledgeBases",
  },
  { id: "storeMounts", label: "Stores", icon: Boxes, field: "storeMounts" },
];

export function ProjectResourcePicker({
  projectId,
  formData,
  onToggleAttachment,
  onClearAttachments,
  skills = [],
  mcps = [],
  restApiTools = [],
  restApiToolSources = [],
  rcpSources = [],
  knowledgeBases = [],
  stores = [],
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAttachedOnly, setShowAttachedOnly] = useState(false);
  const [expandedRcp, setExpandedRcp] = useState({});

  // Prepare normalized unified items list
  const allResources = useMemo(() => {
    const list = [];

    skills.forEach((item) => {
      const id = item._id || item.id;
      list.push({
        id,
        category: "skills",
        name: item.name || item.label || "Untitled Skill",
        description: item.description,
        icon: Cpu,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        badge: "Skill",
        item,
      });
    });

    mcps.forEach((item) => {
      const id = item._id || item.id;
      const authLabel =
        item.authType !== "oauth"
          ? "No auth"
          : item.authMode === "user"
            ? "OAuth · User"
            : "OAuth · Shared";
      list.push({
        id,
        category: "mcps",
        name: item.name || "Untitled MCP",
        description: item.description || item.url,
        icon: Plug,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        badge: authLabel,
        item,
      });
    });

    restApiTools.forEach((item) => {
      const id = item._id || item.id;
      list.push({
        id,
        category: "restApiTools",
        name: item.name || "Untitled REST Tool",
        description: item.description || item.url,
        icon: Wrench,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        badge: item.method || "GET",
        badgeVariant: item.method === "POST" ? "default" : "outline",
        item,
      });
    });

    restApiToolSources.forEach((item) => {
      const id = item._id || item.id;
      const toolCount = (item.tools || []).length;
      list.push({
        id,
        category: "restApiToolSources",
        name: item.name || "Untitled REST Source",
        description: item.description || item.url,
        icon: Globe,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        badge: `${toolCount} tool${toolCount === 1 ? "" : "s"}`,
        item,
      });
    });

    rcpSources.forEach((item) => {
      const id = item._id || item.id;
      const toolCount = (item.tools || []).length;
      const mappedCount = (item.paramContextMap || []).length;
      list.push({
        id,
        category: "rcpSources",
        name: item.name || "Untitled RCP Source",
        description: item.description || item.url,
        icon: Waypoints,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
        badge: `${toolCount} tool${toolCount === 1 ? "" : "s"}${mappedCount > 0 ? ` · ${mappedCount} mapped` : ""}`,
        item,
      });
    });

    knowledgeBases.forEach((item) => {
      const id = item._id || item.id;
      list.push({
        id,
        category: "knowledgeBases",
        name: item.name || "Untitled Knowledge Base",
        description: item.description,
        icon: Database,
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
        badge: item.status || "Active",
        item,
      });
    });

    stores.forEach((item) => {
      const id = item._id || item.id;
      list.push({
        id,
        category: "storeMounts",
        name: item.name || "Untitled Store",
        description: item.description || `Scope: ${item.scope || "project"}`,
        icon: Boxes,
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        badge: `${item.scope || "store"}${item.accessMode === "readonly" ? " · ro" : ""}`,
        item,
      });
    });

    return list;
  }, [
    skills,
    mcps,
    restApiTools,
    restApiToolSources,
    rcpSources,
    knowledgeBases,
    stores,
  ]);

  // Selected totals
  const totalSelectedCount = useMemo(() => {
    return (
      (formData.skills || []).length +
      (formData.mcps || []).length +
      (formData.restApiTools || []).length +
      (formData.restApiToolSources || []).length +
      (formData.rcpSources || []).length +
      (formData.knowledgeBases || []).length +
      (formData.storeMounts || []).length
    );
  }, [formData]);

  const categoryCounts = useMemo(() => {
    return {
      all: allResources.length,
      skills: skills.length,
      mcps: mcps.length,
      restApiTools: restApiTools.length,
      restApiToolSources: restApiToolSources.length,
      rcpSources: rcpSources.length,
      knowledgeBases: knowledgeBases.length,
      storeMounts: stores.length,
    };
  }, [
    allResources,
    skills,
    mcps,
    restApiTools,
    restApiToolSources,
    rcpSources,
    knowledgeBases,
    stores,
  ]);

  const selectedCategoryCounts = useMemo(() => {
    return {
      skills: (formData.skills || []).length,
      mcps: (formData.mcps || []).length,
      restApiTools: (formData.restApiTools || []).length,
      restApiToolSources: (formData.restApiToolSources || []).length,
      rcpSources: (formData.rcpSources || []).length,
      knowledgeBases: (formData.knowledgeBases || []).length,
      storeMounts: (formData.storeMounts || []).length,
    };
  }, [formData]);

  // Filtered items
  const filteredResources = useMemo(() => {
    return allResources.filter((res) => {
      // Category tab filter
      if (activeTab !== "all" && res.category !== activeTab) {
        return false;
      }

      // Check if attached
      const isSelected = (formData[res.category] || []).includes(res.id);
      if (showAttachedOnly && !isSelected) {
        return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = res.name.toLowerCase().includes(q);
        const matchesDesc =
          res.description && res.description.toLowerCase().includes(q);
        const matchesCategory = res.category.toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesCategory;
      }

      return true;
    });
  }, [allResources, activeTab, showAttachedOnly, searchQuery, formData]);

  const getCreateHref = (category) => {
    switch (category) {
      case "skills":
        return developerRoutes.projectSkillNew(projectId);
      case "mcps":
        return developerRoutes.projectMcpNew(projectId);
      case "restApiTools":
        return developerRoutes.projectRestToolNew(projectId);
      case "restApiToolSources":
        return developerRoutes.projectRestToolSourceNew(projectId);
      case "rcpSources":
        return developerRoutes.projectRcpSourceNew(projectId);
      case "knowledgeBases":
        return developerRoutes.projectKnowledgeNew(projectId);
      case "storeMounts":
        return developerRoutes.projectStoreNew(projectId);
      default:
        return developerRoutes.project(projectId);
    }
  };

  const getCreateLabel = (category) => {
    switch (category) {
      case "skills":
        return "New Skill";
      case "mcps":
        return "Add MCP Server";
      case "restApiTools":
        return "New REST Tool";
      case "restApiToolSources":
        return "New REST Source";
      case "rcpSources":
        return "New RCP Source";
      case "knowledgeBases":
        return "New Knowledge Base";
      case "storeMounts":
        return "New Store";
      default:
        return "Add Resource";
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header with summary and stats */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
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

        {totalSelectedCount > 0 && onClearAttachments && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAttachments}
            className="h-7 text-xs text-muted-foreground hover:text-destructive self-start sm:self-auto"
          >
            Clear all attachments
          </Button>
        )}
      </div>

      {/* Selected pills summary if any selected */}
      {totalSelectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-2 text-xs">
          <span className="font-medium text-muted-foreground text-[11px] mr-1">
            Active:
          </span>
          {Object.entries(selectedCategoryCounts).map(([cat, count]) => {
            if (count === 0) return null;
            const def = CATEGORIES.find((c) => c.field === cat || c.id === cat);
            const Icon = def?.icon || Cpu;
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

      {/* Tabs / Filters Bar */}
      <div className="space-y-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9 w-full justify-start overflow-x-auto bg-muted/40 p-1 flex-nowrap">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id];
              const selCount =
                cat.id === "all"
                  ? totalSelectedCount
                  : selectedCategoryCounts[cat.field || cat.id] || 0;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="gap-1.5 text-xs shrink-0 data-[state=active]:bg-background"
                >
                  {cat.label}
                  {count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                      {selCount > 0 ? `${selCount}/${count}` : count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Search & Toggle row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
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
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={showAttachedOnly}
                onChange={(e) => setShowAttachedOnly(e.target.checked)}
                className="rounded border-muted-foreground/30 text-primary"
              />
              Show attached only ({totalSelectedCount})
            </label>
          </div>
        </div>
      </div>

      {/* Resources Card Grid */}
      {filteredResources.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {searchQuery || showAttachedOnly
              ? "No resources match your search criteria."
              : `No ${activeTab !== "all" ? CATEGORIES.find((c) => c.id === activeTab)?.label : "tools or resources"} created in this Project yet.`}
          </p>
          {activeTab !== "all" && (
            <Link
              href={getCreateHref(activeTab)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="size-3.5" />
                {getCreateLabel(activeTab)}
                <ExternalLink className="size-3 opacity-60 ml-0.5" />
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filteredResources.map((res) => {
            const isSelected = (formData[res.category] || []).includes(res.id);
            const Icon = res.icon;
            const isRcp = res.category === "rcpSources";
            const rcpItem = isRcp ? res.item : null;
            const rcpParamsCount = (rcpItem?.paramContextMap || []).length;
            const isExpanded = !!expandedRcp[res.id];

            return (
              <div
                key={res.id}
                className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/60 shadow-xs"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                }`}
              >
                {/* Main Card Header / Content */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onToggleAttachment(res.category, res.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`rounded-lg p-1.5 ${res.bg} ${res.color} shrink-0`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {res.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          {
                            CATEGORIES.find(
                              (c) =>
                                c.field === res.category ||
                                c.id === res.category,
                            )?.label
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.badge && (
                        <Badge
                          variant={res.badgeVariant || "outline"}
                          className="font-mono text-[10px] px-1.5 py-0"
                        >
                          {res.badge}
                        </Badge>
                      )}
                      <div
                        className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 bg-background"
                        }`}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {res.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {res.description}
                    </p>
                  )}
                </div>

                {/* Special RCP Tool & Context Mapping preview when attached */}
                {isRcp && isSelected && (
                  <div className="mt-3 pt-2.5 border-t border-border/60 text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                        <Zap className="size-3 text-amber-500" />
                        {rcpParamsCount > 0
                          ? `${rcpParamsCount} param${rcpParamsCount === 1 ? "" : "s"} resolved from context`
                          : "No context params mapped"}
                      </span>

                      <div className="flex items-center gap-1">
                        <Link
                          href={developerRoutes.projectRcpSourceEdit(
                            projectId,
                            res.id,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline px-1 py-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Configure Source
                          <ExternalLink className="size-2.5" />
                        </Link>
                        {rcpParamsCount > 0 && (
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
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Mapped Params List */}
                    {isExpanded && rcpParamsCount > 0 && (
                      <div className="space-y-1 rounded-md bg-muted/40 p-2 text-[11px] font-mono">
                        {(rcpItem.paramContextMap || []).map((m) => (
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
