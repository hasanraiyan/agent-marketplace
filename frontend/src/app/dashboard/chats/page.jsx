"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bot, MessageSquare, Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { getThreads, deleteThread, updateThreadTitle } from "@/lib/api/threads";

function formatRelative(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ChatsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const res = await getThreads();
      setThreads(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load chats");
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchThreads();
    }
  }, [isLoaded, isSignedIn]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteThread(deleteTarget.id || deleteTarget._id);
      toast.success("Chat deleted");
      setDeleteTarget(null);
      fetchThreads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete chat");
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (thread) => {
    setEditingId(thread.id || thread._id);
    setEditTitle(thread.title || "New Conversation");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveTitle = async (threadId) => {
    if (!editTitle.trim()) return;
    setSavingTitle(true);
    try {
      await updateThreadTitle(threadId, { title: editTitle.trim() });
      toast.success("Title updated");
      setEditingId(null);
      fetchThreads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update title");
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <h1 className="text-3xl font-bold tracking-tight">Chats</h1>
          <p className="text-muted-foreground">
            Resume your conversations with agents.
          </p>
        </div>

        <div className="px-4 lg:px-6">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No chats yet</EmptyTitle>
                <EmptyDescription>
                  Start a conversation with an agent to see it here.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/agents">
                  <Button>
                    <MessageSquare data-icon="inline-start" />
                    Browse Agents
                  </Button>
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {threads.map((thread) => {
                const threadId = thread.id || thread._id;
                const agent = thread.agentId;
                const isEditing = editingId === threadId;

                return (
                  <Card
                    key={threadId}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <Avatar className="size-10 shrink-0">
                        <AvatarImage src={agent?.avatar} alt={agent?.name} />
                        <AvatarFallback>
                          <Bot className="size-5" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveTitle(threadId);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              maxLength={100}
                              autoFocus
                              disabled={savingTitle}
                            />
                            <Button
                              size="icon-sm"
                              onClick={() => saveTitle(threadId)}
                              disabled={savingTitle}
                            >
                              <Check />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={cancelEdit}
                              disabled={savingTitle}
                            >
                              <X />
                            </Button>
                          </div>
                        ) : (
                          <Link
                            href={`/dashboard/chats/${threadId}`}
                            className="block"
                          >
                            <p className="truncate font-medium hover:text-primary">
                              {thread.title || "New Conversation"}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="truncate">
                                {agent?.name || "Agent"}
                              </span>
                              <span>•</span>
                              <span>
                                {formatRelative(thread.lastMessageAt)}
                              </span>
                            </div>
                          </Link>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(thread)}
                            title="Rename"
                          >
                            <Edit2 />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(thread)}
                            title="Delete"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">
                {deleteTarget?.title || "New Conversation"}
              </span>{" "}
              and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
