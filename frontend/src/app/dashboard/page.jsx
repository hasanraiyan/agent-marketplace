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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
} from "@/components/ui/pagination";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { searchAgents, countAgents } from "@/lib/api/agents";
import { AgentExploreCard } from "@/components/agents/agent-explore-card";

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
      } catch (err) {
        setFeatured([]);
      } finally {
        setFeaturedLoading(false);
      }
    };
    loadFeatured();
  }, []);

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

  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-6">
      <section className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hello, {firstName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Discover agents built by the community.
            </p>
          </div>
          <Link href="/dashboard/agents/create">
            <Button>
              <PlusIcon data-icon="inline-start" />
              Create Agent
            </Button>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4 px-4 lg:px-6">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search agents by name..."
            value={search}
            onChange={handleSearchChange}
          />
        </InputGroup>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ScrollArea className="w-full sm:max-w-[calc(100%-12rem)]">
            <ToggleGroup
              type="single"
              value={category}
              onValueChange={handleCategoryChange}
              variant="outline"
              className="w-max"
            >
              {CATEGORIES.map((cat) => (
                <ToggleGroupItem
                  key={cat.value}
                  value={cat.value}
                  className="capitalize"
                >
                  {cat.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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

      {!filtersActive && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-4 lg:px-6">
            <FlameIcon className="size-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">
              Featured agents
            </h2>
          </div>

          {featuredLoading ? (
            <div className="flex gap-4 overflow-hidden px-4 lg:px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-[4/3] w-64 shrink-0 rounded-xl sm:w-72"
                />
              ))}
            </div>
          ) : featured.length > 0 ? (
            <ScrollArea className="w-full">
              <div className="flex gap-4 px-4 pb-3 lg:px-6">
                {featured.map((agent) => (
                  <div
                    key={agent._id || agent.id}
                    className="w-64 shrink-0 sm:w-72"
                  >
                    <AgentExploreCard agent={agent} />
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : null}

          <div className="px-4 lg:px-6">
            <Separator />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            {filtersActive ? "Results" : "All agents"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${total} agent${total === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Empty>
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
                <Button variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  Create Agent
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentExploreCard key={agent._id || agent.id} agent={agent} />
            ))}
          </div>
        )}

        {totalPages > 1 && !loading && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(page - 1);
                      }}
                    />
                  </PaginationItem>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
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
                {page < totalPages && (
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(page + 1);
                      }}
                    />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </section>
    </div>
  );
}
