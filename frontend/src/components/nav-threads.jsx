"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MoreHorizontalIcon,
  ChevronRightIcon,
  BotIcon,
  Trash2Icon,
  PencilIcon,
  MessageSquareIcon,
  CheckIcon,
  XIcon,
  SearchIcon,
  Loader2Icon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Inline rename input ──────────────────────────────────────────────────────
function InlineRename({ currentTitle, onConfirm, onCancel }) {
  const [value, setValue] = useState(currentTitle);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onConfirm(value.trim() || currentTitle);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex flex-1 items-center gap-1 overflow-hidden pr-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-0 flex-1 rounded border border-sidebar-border bg-sidebar px-1.5 text-xs text-sidebar-foreground outline-none ring-0 focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={() => onConfirm(value.trim() || currentTitle)}
        className="shrink-0 rounded p-0.5 text-green-500 hover:bg-green-500/10"
      >
        <CheckIcon className="size-3" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-500/10"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

// ─── Single thread item ───────────────────────────────────────────────────────
function ThreadItem({ thread, isActive, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const { isMobile } = useSidebar();
  const threadId = thread._id || thread.id;

  const handleConfirmRename = async (newTitle) => {
    setRenaming(false);
    if (newTitle === thread.title) return;
    try {
      await onRename(threadId, newTitle);
    } catch {
      toast.error("Failed to rename thread");
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(threadId);
    } catch {
      toast.error("Failed to delete thread");
    }
  };

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild={!renaming}
        isActive={isActive}
        className={cn(
          "group/thread h-7 gap-1.5",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        {renaming ? (
          <InlineRename
            currentTitle={thread.title || "New Conversation"}
            onConfirm={handleConfirmRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <Link
            href={`/dashboard/agents/${thread.agentId?._id || thread.agentId?.id || thread.agentId}/run?threadId=${threadId}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          >
            <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs">
              {thread.title || "New Conversation"}
            </span>
          </Link>
        )}
      </SidebarMenuSubButton>

      {!renaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="right-0.5 top-0.5 size-5 rounded"
            >
              <MoreHorizontalIcon className="size-3" />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-36 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align={isMobile ? "end" : "start"}
          >
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <PencilIcon className="size-3.5" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
              <Trash2Icon className="size-3.5" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuSubItem>
  );
}

// ─── Agent group ─────────────────────────────────────────────────────────────
function AgentGroup({ group, activeThreadId, onRename, onDelete }) {
  const { agent, threads, totalCount } = group;
  const agentId = agent._id || agent.id;
  const hasActive = threads.some((t) => (t._id || t.id) === activeThreadId);
  // Start open if the active thread belongs to this agent
  const [open, setOpen] = useState(hasActive);

  // When searching, we might want to show all groups open by default if they have matches
  // But for now, let's stick to the active thread logic.

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={agent.name} className="gap-2">
            <Avatar className="size-4 shrink-0">
              <AvatarImage
                src={agent.avatarUrl || agent.avatar}
                alt={agent.name}
              />
              <AvatarFallback className="bg-muted text-[8px]">
                <BotIcon className="size-2.5" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate font-medium">
              {agent.name || "Agent"}
            </span>
            <span
              className="shrink-0 rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-accent-foreground"
              title={`${threads.length} loaded, ${totalCount || threads.length} total`}
            >
              {totalCount || threads.length}
            </span>
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {threads.length === 0 && totalCount > 0 ? (
              <SidebarMenuSubItem>
                <div className="px-6 py-2 text-[10px] text-muted-foreground/60 italic">
                  Threads not loaded yet. Scroll or search to find them.
                </div>
              </SidebarMenuSubItem>
            ) : (
              threads.map((thread) => (
                <ThreadItem
                  key={thread._id || thread.id}
                  thread={thread}
                  isActive={(thread._id || thread.id) === activeThreadId}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * NavThreads — renders all user threads grouped by agent in the sidebar.
 *
 * Props:
 *   groups    - Array<{ agent, threads[] }>  (from useUserThreads)
 *   loading   - boolean
 *   onRename  - (threadId, title) => Promise
 *   onDelete  - (threadId) => Promise
 */
export function NavThreads({
  groups,
  totalThreads,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRename,
  onDelete,
  searchQuery,
  onSearchChange,
  isSearching,
}) {
  const pathname = usePathname();

  // Determine the active thread from the URL: /dashboard/agents/[id]/run?threadId=...
  // We also check if the URL segment is a known threadId from our list
  const activeThreadId = (() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("threadId") || null;
  })();

  const loadedThreadsCount = groups.reduce(
    (acc, group) => acc + group.threads.length,
    0,
  );

  if (loading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Threads</SidebarGroupLabel>
        <SidebarMenu>
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3 flex-1 rounded" />
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between pr-2">
        <SidebarGroupLabel>Threads</SidebarGroupLabel>
        {totalThreads > 0 && !isSearching && (
          <span className="text-[10px] text-muted-foreground/60">
            {loadedThreadsCount} of {totalThreads}
          </span>
        )}
      </div>

      <div className="relative mb-2 px-2">
        <SearchIcon className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search threads..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/50 pl-8 pr-8 text-xs outline-none ring-0 transition-all focus:border-primary/50 focus:bg-sidebar-accent"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted"
          >
            <XIcon className="size-3 text-muted-foreground/60" />
          </button>
        )}
      </div>

      <SidebarMenu>
        {isSearching && groups.length === 0 ? (
          <SidebarMenuItem>
            <div className="px-2 py-3 text-center">
              <p className="text-xs text-muted-foreground/60">
                No threads found for &quot;{searchQuery}&quot;
              </p>
            </div>
          </SidebarMenuItem>
        ) : groups.length === 0 ? (
          <SidebarMenuItem>
            <div className="px-2 py-3 text-center">
              <MessageSquareIcon className="mx-auto mb-1.5 size-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/60">
                No threads yet.
                <br />
                Start a conversation!
              </p>
            </div>
          </SidebarMenuItem>
        ) : (
          groups.map((group) => (
            <AgentGroup
              key={group.agent._id || group.agent.id}
              group={group}
              activeThreadId={activeThreadId}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}

        {!isSearching && hasMore && (
          <SidebarMenuItem className="mt-2 px-2">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-sidebar-border py-1.5 text-center text-xs font-semibold text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-primary disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2Icon className="size-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                "Load More Chats"
              )}
            </button>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
