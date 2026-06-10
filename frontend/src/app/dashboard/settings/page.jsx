"use client";

import React, { useState, useEffect } from "react";
import { ProviderList } from "./ProviderList";
import { getProviders } from "@/lib/api/providers";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { useThreads } from "@/components/threads-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { removeAllThreads } = useThreads();

  useDashboardHeader({
    title: "Settings",
    description: "Manage integrations and database history.",
  });

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await getProviders();
      if (res.data && res.data.success) {
        setProviders(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch providers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchProviders();
    }
  }, [isLoaded, isSignedIn]);

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      await removeAllThreads();
      toast.success("Complete chat history deleted successfully.");
      setIsAlertOpen(false);
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
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">
              AI Providers
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure OpenAI-compatible providers to power your AI models.
            </p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading providers...
            </div>
          ) : (
            <ProviderList providers={providers} onUpdate={fetchProviders} />
          )}
        </section>

        <section className="border-t pt-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-destructive">
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground">
              Irreversible actions that permanently delete your data.
            </p>
          </div>

          <Card className="border border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-destructive font-semibold">
                Delete All Chat History
              </CardTitle>
              <CardDescription className="text-destructive/80">
                Permanently delete all conversations, chat history, and agent
                state. This action is irreversible.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
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
        </section>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. It will permanently delete your
              entire conversation history across all agents and remove all
              existing chat sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHistory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Permanently Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
