"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  SearchIcon,
  PlusIcon,
  SparklesIcon,
  FlameIcon,
  ClockIcon,
  TrendingUpIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { searchAgents, countAgents } from "@/lib/api/agents";
import { AgentExploreCard } from "@/components/agents/agent-explore-card";
import { AgentFeaturedCard } from "@/components/agents/agent-featured-card";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "productivity", label: "Productivity" },
  { value: "coding", label: "Coding" },
  { value: "creative", label: "Creative" },
  { value: "research", label: "Research" },
  { value: "roleplay", label: "Roleplay" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest", icon: ClockIcon },
  { value: "popularity", label: "Popular", icon: TrendingUpIcon },
  { value: "relevance", label: "Relevant", icon: SparklesIcon },
];

const PAGE_SIZE = 12;

// Helper to build paginator page numbers with ellipsis
function buildPageRange(current, total ){
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function ExplorePage() {
  const { user } = useUser();

  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  const [agents, setAgents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [page, setPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const filtersActive = search.trim() !== "" || category !== "all";

  const pageRange = useMemo(
    () => buildPageRange(page, totalPages),
    [page, totalPages],
  );

  // ── Featured ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadFeatured = async () => {
      try {
        setFeaturedLoading(true);
        const res = await searchAgents({
          page: 1,
          limit: 10,
          sortBy: "popularity",
        });
        setFeatured(res.data?.data || []);
      } catch {
        setFeatured([]);
      } finally {
        setFeaturedLoading(false);
      }
    };
    loadFeatured();
  }, []);

  // ── Agents list ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAgents = async () => {
      setLoading(true);
      try {
        const filters = {
          ...(search.trim() && { search: search.trim() }),
          ...(category !== "all" && { category }),
        };
        const [list, count] = await Promise.all([
          searchAgents({ ...filters, page, limit: PAGE_SIZE, sortBy }),
          countAgents(filters),
        ]);
        setAgents(list.data?.data || []);
        setTotal(count.data?.data?.total || 0);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load agents");
        setAgents([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    const handle = setTimeout(loadAgents, 250);
    return () => clearTimeout(handle);
  }, [search, category, sortBy, page]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCategoryChange = (value) => {
    if (!value) return;
    setCategory(value);
    setPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  const firstName =
    user?.firstName || user?.fullName?.split(" ")[0] || "there";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            Hello, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
            Discover agents built by the community.
          </p>
        </div>

        {/* Search - moved to header */}
        <div className="w-full sm:max-w-xs md:max-w-sm">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search agents..."
              value={search}
              onChange={handleSearchChange}
              className="text-base" // prevents iOS zoom on focus
            />
          </InputGroup>
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-col gap-3 px-4 lg:px-6">
        {/* Categories + Sort — stacked on mobile, inline on sm+ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Category pills — horizontally scrollable */}
          <div className="min-w-0 flex-1">
            <ScrollArea className="w-full">
              <ToggleGroup
                type="single"
                value={category}
                onValueChange={handleCategoryChange}
                variant="outline"
                className="w-max gap-1.5 pb-1"
              >
                {CATEGORIES.map((cat) => (
                  <ToggleGroupItem
                    key={cat.value}
                    value={cat.value}
                    className="h-8 rounded-full px-3 text-xs capitalize sm:h-9 sm:px-4 sm:text-sm"
                  >
                    {cat.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>
          </div>

          {/* Sort select */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="h-8 w-full gap-1.5 sm:h-9 sm:w-44">
              <SlidersHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <opt.icon data-icon="inline-start" />
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── Featured Strip ── */}
      {!filtersActive && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-4 lg:px-6">
            <FlameIcon className="size-4 text-orange-500 sm:size-5" />
            <h2 className="text-base font-semibold tracking-tight sm:text-xl">
              Featured agents
            </h2>
          </div>

          {featuredLoading ? (
            /* Skeleton strip */
            <div className="flex gap-3 overflow-hidden px-4 lg:px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-4/3 w-56 shrink-0 rounded-xl sm:w-72"
                />
              ))}
            </div>
          ) : featured.length > 0 ? (
            <ScrollArea className="w-full">
              <div className="flex gap-3 px-4 pb-3 lg:px-6">
                {featured.map((agent) => (
                  <div
                    key={agent._id || agent.id}
                    className="w-56 shrink-0 sm:w-72"
                  >
                    <AgentFeaturedCard agent={agent} />
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="mx-4 lg:mx-6" />
            </ScrollArea>
          ) : null}

          <div className="px-4 lg:px-6">
            <Separator />
          </div>
        </section>
      )}

      {/* ── All / Results Grid ── */}
      <section className="flex flex-col gap-4 px-4 lg:px-6">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight sm:text-xl">
            {filtersActive ? "Results" : "All agents"}
          </h2>

          {!loading && (
            <Badge variant="secondary" className="tabular-nums">
              {total} {total === 1 ? "agent" : "agents"}
            </Badge>
          )}
          {loading && <Skeleton className="h-5 w-20 rounded-full" />}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl sm:h-80" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyTitle>No agents found</EmptyTitle>
              <EmptyDescription>
                {filtersActive
                  ? "Try adjusting your search or filters."
                  : "Be the first to publish a public agent."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/dashboard/agents/create">
                <Button variant="outline" size="sm">
                  <PlusIcon data-icon="inline-start" />
                  Create Agent
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentExploreCard key={agent._id || agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && !loading && (
          <div className="mt-2 flex justify-center">
            <Pagination>
              <PaginationContent className="flex-wrap gap-1">
                {/* Prev */}
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page === 1}
                    className={
                      page === 1 ? "pointer-events-none opacity-40" : ""
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>

                {/* Page numbers — hide on very small screens, show on sm+ */}
                <div className="hidden items-center gap-1 sm:flex">
                  {pageRange.map((p, idx) =>
                    p === "..." ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                </div>

                {/* Mobile: just "page X of Y" text */}
                <span className="flex items-center px-3 text-sm text-muted-foreground sm:hidden">
                  {page} / {totalPages}
                </span>

                {/* Next */}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page === totalPages}
                    className={
                      page === totalPages
                        ? "pointer-events-none opacity-40"
                        : ""
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </section>
    </div>
  );
}