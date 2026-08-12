"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
    <div className="flex flex-1 items-center gap-1.5 overflow-hidden pr-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none ring-0 focus:border-[#1E60FF] focus:ring-1 focus:ring-[#1E60FF]"
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
          "group/thread h-9 gap-2.5 pr-8 rounded-xl transition-all duration-200 border-l-2 border-transparent px-3",
          isActive
            ? "bg-zinc-200/50 text-zinc-900 font-semibold shadow-xs border-l-[#1E60FF]!"
            : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/40",
        )}
      >
        {renaming ? (
          <InlineRename
            currentTitle={thread.title || "New Conversation"}
            onConfirm={handleConfirmRename}
            onCancel={() => setRenaming(false)}
          />
        ) : agent?.isDeleted ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden opacity-60 grayscale">
            <Avatar className="size-5 shrink-0 rounded-[6px]">
              <AvatarFallback className="bg-muted text-[8px] rounded-[6px]">
                <BotIcon className="size-3" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {thread.title || "New Conversation"}
            </span>
          </div>
        ) : (
          <Link
            href={`/dashboard/agents/${agent?._id || agent?.id || thread.agentId?._id || thread.agentId?.id || thread.agentId}/run?threadId=${threadId}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
          >
            <Avatar className="size-5 shrink-0 rounded-[6px]">
              <AvatarImage
                src={agent?.avatarUrl || agent?.avatar}
                alt={agent?.name || "Agent"}
                className="rounded-[6px] object-cover"
              />
              <AvatarFallback className="bg-muted text-[8px] rounded-[6px]">
                <BotIcon className="size-3" />
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
              className="right-2 top-2 size-5 rounded-md hover:bg-zinc-200/50 transition-colors"
            >
              <MoreHorizontalIcon className="size-3 text-zinc-500" />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-36 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align={isMobile ? "end" : "start"}
          >
            <DropdownMenuItem
              onSelect={() => setRenaming(true)}
              className="cursor-pointer"
            >
              <PencilIcon className="size-3.5 mr-2" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={handleDelete}
              className="cursor-pointer"
            >
              <Trash2Icon className="size-3.5 mr-2" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuItem>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function NavThreads({
  groups,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRename,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(true);

  const activeThreadId = (() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("threadId") || null;
  })();

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
      <SidebarGroup className="group-data-[collapsible=icon]:hidden border-t border-zinc-100/60 pt-4 px-0">
        <SidebarGroupLabel className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 mb-2 px-3">
          Threads
        </SidebarGroupLabel>
        <SidebarMenu>
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="size-5 rounded-[6px]" />
                <Skeleton className="h-3.5 flex-1 rounded-md" />
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible
      id="onboarding-dashboard-threads"
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/collapsible data-[state=open]:flex-1 data-[state=open]:min-h-0 flex flex-col overflow-hidden border-t border-zinc-200/50 pt-4"
    >
      <SidebarGroup className="group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:flex-1 group-data-[state=open]/collapsible:min-h-0 flex flex-col overflow-hidden p-0">
        <SidebarGroupLabel
          asChild
          className="cursor-pointer select-none text-[11px] font-bold tracking-wider uppercase text-zinc-400 hover:text-zinc-600 transition-colors px-3 mb-2"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <span className="flex items-center gap-1.5">
              Threads
              {allThreads.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[9px] font-semibold text-zinc-500 select-none">
                  {allThreads.length}
                </span>
              )}
            </span>
            <ChevronRightIcon className="size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="group-data-[state=open]/collapsible:flex-1 group-data-[state=open]/collapsible:min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto select-none no-scrollbar min-h-0">
            <SidebarMenu className="gap-0.5">
              {allThreads.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-3 py-6 text-center">
                    <MessageSquareIcon className="mx-auto mb-2 size-6 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/50">
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
                <SidebarMenuItem className="mt-2 px-2 pb-1">
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-[#1E60FF] py-1.5 px-2 border border-dashed border-zinc-200 rounded-lg hover:bg-zinc-100/50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? "Loading more..." : "Load More Chats"}
                  </button>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </div>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
