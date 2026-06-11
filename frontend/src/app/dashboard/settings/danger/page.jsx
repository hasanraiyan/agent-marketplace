"use client";

import React, { useState } from "react";
import { useThreads } from "@/components/threads-context";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
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
import { useDashboardHeader } from "@/components/dashboard-header-context";

export default function DangerZonePage() {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { removeAllThreads } = useThreads();

  useDashboardHeader({
    title: "Danger Zone",
    description: "Irreversible actions that permanently delete your data.",
  });

  const handleDeleteHistory = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm.");
      return;
    }

    setIsDeleting(true);
    try {
      await removeAllThreads();
      toast.success("Complete chat history deleted successfully.");
      setIsAlertOpen(false);
      setConfirmText("");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to delete chat history.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-destructive">Destructive Actions</h3>
          <p className="text-sm text-destructive/80">
            These actions are permanent and cannot be undone. Please proceed with extreme caution.
          </p>
        </div>
      </div>

      <Card className="border-destructive/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-destructive">Delete All Chat History</CardTitle>
          <CardDescription>
            Permanently deletes all conversations, chat history, and agent state across all agents. This action is irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="flex items-center gap-2"
            onClick={() => setIsAlertOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete Complete Chat History
          </Button>
        </CardContent>
      </Card>

      <Card className="border-muted opacity-60">
        <CardHeader>
          <CardTitle>Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This feature is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete your **entire conversation history** across all agents. You will lose all message threads and agent memory state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <p className="text-sm font-medium">
              Please type <span className="font-bold">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="border-destructive focus-visible:ring-destructive"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteHistory();
              }}
              disabled={isDeleting || confirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Permanently Delete All"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
