"use client";

import { useState, useRef, useMemo } from "react";
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
function ThreadItem({ thread, agent, isActive, onRename, onDelete }) {
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
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!renaming && !agent?.isDeleted}
        isActive={isActive}
        className={cn(
          "group/thread h-8 gap-2 pr-8",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        {renaming ? (
          <InlineRename
            currentTitle={thread.title || "New Conversation"}
            onConfirm={handleConfirmRename}
            onCancel={() => setRenaming(false)}
          />
        ) : agent?.isDeleted ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden opacity-60 grayscale">
            <Avatar className="size-4 shrink-0">
              <AvatarFallback className="bg-muted text-[8px]">
                <BotIcon className="size-2.5" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs">
              {thread.title || "New Conversation"}
            </span>
          </div>
        ) : (
          <Link
            href={`/dashboard/agents/${agent?._id || agent?.id || thread.agentId?._id || thread.agentId?.id || thread.agentId}/run?threadId=${threadId}`}
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
          >
            <Avatar className="size-4 shrink-0">
              <AvatarImage
                src={agent?.avatarUrl || agent?.avatar}
                alt={agent?.name || "Agent"}
              />
              <AvatarFallback className="bg-muted text-[8px]">
                <BotIcon className="size-2.5" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {thread.title || "New Conversation"}
            </span>
          </Link>
        )}
      </SidebarMenuButton>

      {!renaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="right-1 top-1.5 size-5 rounded"
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
    </SidebarMenuItem>
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
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRename,
  onDelete,
}) {
  const pathname = usePathname();

  // Determine the active thread from the URL: /dashboard/agents/[id]/run?threadId=...
  const activeThreadId = (() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("threadId") || null;
  })();

  // Flatten and sort all threads by recency
  const allThreads = useMemo(() => {
    const list = [];
    for (const group of groups) {
      for (const thread of group.threads) {
        list.push({
          ...thread,
          agent: group.agent,
        });
      }
    }
    list.sort((a, b) => {
      const aDate = new Date(a.lastMessageAt || a.createdAt || 0);
      const bDate = new Date(b.lastMessageAt || b.createdAt || 0);
      return bDate - aDate;
    });
    return list;
  }, [groups]);

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
      <SidebarGroupLabel>Threads</SidebarGroupLabel>
      <SidebarMenu>
        {allThreads.length === 0 ? (
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
          allThreads.map((thread) => (
            <ThreadItem
              key={thread._id || thread.id}
              thread={thread}
              agent={thread.agent}
              isActive={(thread._id || thread.id) === activeThreadId}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}

        {hasMore && (
          <SidebarMenuItem className="mt-2 px-2">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary py-1 px-2 border border-dashed border-sidebar-border rounded-md hover:bg-sidebar-accent transition-all cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? "Loading more..." : "Load More Chats"}
            </button>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
