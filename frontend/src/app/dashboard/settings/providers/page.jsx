"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getProviders, deleteProvider, testProviderConnection } from "@/lib/api/providers";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Edit,
  Play,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

export default function ProvidersSettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useDashboardHeader({
    title: "AI Providers",
    description: "Configure OpenAI-compatible providers to power your AI models.",
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

  const handleTestConnection = async (id) => {
    setTestingId(id);
    try {
      const res = await testProviderConnection(id);
      if (res.data && res.data.success) {
        setTestResults((prev) => ({ ...prev, [id]: "success" }));
        toast.success(res.data.data.message || "Connection successful!");
      } else {
        setTestResults((prev) => ({ ...prev, [id]: "error" }));
      }
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: "error" }));
      toast.error(err.response?.data?.message || "Connection failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteProvider(deleteId);
      toast.success("Provider deleted successfully");
      setDeleteId(null);
      fetchProviders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete provider");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="border rounded-md">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Providers</h2>
          <p className="text-muted-foreground">
            Manage your AI model integrations.
          </p>
        </div>
        <Link href="/dashboard/settings/providers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </Link>
      </div>

      {providers.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="hidden md:table-cell">Base URL</TableHead>
                <TableHead className="hidden sm:table-cell">Default Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {provider.label}
                      {provider.isDefault && (
                        <Badge variant="outline">Default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground" title={provider.baseURL}>
                    {provider.baseURL}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {provider.defaultModel}
                  </TableCell>
                  <TableCell>
                    {testingId === provider.id ? (
                      <Badge variant="secondary" className="animate-pulse">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Testing
                      </Badge>
                    ) : testResults[provider.id] === "success" ? (
                      <Badge variant="success" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Online
                      </Badge>
                    ) : testResults[provider.id] === "error" ? (
                      <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/20">
                        <XCircle className="mr-1 h-3 w-3" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Untested
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTestConnection(provider.id)}
                        disabled={testingId === provider.id}
                        title="Test Connection"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Link href={`/dashboard/settings/providers/${provider.id}/edit`}>
                        <Button variant="ghost" size="icon" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(provider.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border-dashed">
          <EmptyHeader>
            <EmptyTitle>No providers configured</EmptyTitle>
            <EmptyDescription>
              Add an OpenAI-compatible provider to start using AI models.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/dashboard/settings/providers/new">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add your first provider
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this provider? Any agents using this provider will stop working until updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Provider"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
