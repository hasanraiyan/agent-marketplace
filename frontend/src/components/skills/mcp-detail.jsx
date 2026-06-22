"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnectors } from "@/app/dashboard/connectors/connectors-context";
import { testMcp, getOwnerAuthorizeUrl } from "@/lib/api/mcps";
import { toast } from "sonner";
import {
  Server,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Globe,
  Radio,
  Users,
  Lock,
  Code,
  RefreshCw,
  Calendar,
  Loader2,
  Plug,
  Bot,
  Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import Link from "next/link";
import { useRouter } from "next/navigation";

export function McpDetail({ mcp }) {
  const router = useRouter();
  const {
    toggleMcp,
    deleteMcp,
    refreshMcps,
  } = useConnectors();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTestConnection = useCallback(async () => {
    if (!mcp) return;
    setIsTesting(true);
    try {
      const res = await testMcp(mcp._id);
      const tools = res.data?.data || [];
      await refreshMcps();
      toast.success(`Connection successful — ${tools.length} tool(s) found`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  }, [mcp, refreshMcps]);

  const handleConnectOwner = useCallback(async () => {
    if (!mcp) return;
    setIsConnecting(true);
    try {
      const res = await getOwnerAuthorizeUrl(mcp._id);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start OAuth connection");
      setIsConnecting(false);
    }
  }, [mcp]);

  const handleDeleteConfirm = async () => {
    if (!mcp) return;
    setIsDeleting(true);
    await deleteMcp(mcp._id);
    setShowDeleteDialog(false);
    setIsDeleting(false);
    router.push("/dashboard/connectors/mcps");
  };

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-8 lg:col-span-2">
            {/* Overview / Identity Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardContent className="px-6 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="size-20 sm:size-24 rounded-2xl sm:rounded-3xl border border-zinc-150/60 dark:border-zinc-800 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                    <Server className="size-10 sm:size-12" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge
                        variant={mcp.isEnabled ? "default" : "outline"}
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      >
                        {mcp.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="capitalize text-xs font-semibold px-2.5 py-0.5 border-zinc-150/60 dark:border-zinc-800 bg-background/50 flex items-center gap-1 rounded-full"
                      >
                        <Globe className="size-3" />
                        {mcp.transport === "sse" ? "SSE" : "Streamable HTTP"}
                      </Badge>
                      {mcp.authType === "oauth" && (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold px-2.5 py-0.5 border-zinc-150/60 dark:border-zinc-800 bg-background/50 flex items-center gap-1 rounded-full"
                        >
                          <Lock className="size-3" />
                          OAuth · {mcp.authMode === "owner" ? "Shared" : "Per-user"}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                      {mcp.name}
                    </h2>

                    <p className="text-sm sm:text-base leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                      {mcp.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <Separator className="my-5" />

                {/* Connection Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Connection
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                    >
                      {isTesting && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                      Test Connection
                    </Button>
                  </div>

                  <div className="p-3 bg-muted rounded-lg font-mono text-xs truncate border">
                    {mcp.url}
                  </div>

                  {mcp.authType === "oauth" ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="text-muted-foreground">Client ID:</span>
                        <span className="font-mono text-xs">{mcp.oauth?.clientId}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Client Secret:</span>
                        <span className="font-mono text-xs">
                          {mcp.oauth?.hasClientSecret ? "••••••••••••" : "Not set"}
                        </span>
                      </div>

                      {mcp.authMode === "owner" ? (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm">
                            {mcp.oauth?.ownerConnected ? (
                              <>
                                <CheckCircle2 className="size-4 text-emerald-500" />
                                <span>Connected</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="size-4 text-amber-500" />
                                <span>Not connected</span>
                              </>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={mcp.oauth?.ownerConnected ? "outline" : "default"}
                            onClick={handleConnectOwner}
                            disabled={isConnecting}
                          >
                            {isConnecting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                            {mcp.oauth?.ownerConnected ? "Reconnect" : "Connect"}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic pt-2 border-t">
                          Per-user authentication: each user of an agent using this connector
                          will be prompted to connect their own account before its tools become
                          available to them.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-1">
                      No authentication — this server accepts requests without credentials.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Security Boundary Callout */}
            <div className="rounded-xl border border-dashed p-4 flex gap-3 bg-primary/5 rounded-3xl">
              <Shield className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Security Boundary</p>
                <p className="text-muted-foreground leading-relaxed">
                  Client secrets and OAuth tokens are encrypted at rest and never shown after
                  they&apos;re saved. Only attach servers you trust with the data your agents can
                  access.
                </p>
              </div>
            </div>

            {/* Tools Exchanged Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <Code className="size-4 text-primary" />
                  Tools Exchanged
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Tools this MCP server exposes to your agents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="rounded-full">
                    {mcp.tools?.length || 0} tools
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${isTesting ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {mcp.tools && mcp.tools.length > 0 ? (
                    mcp.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="p-3 rounded-lg border bg-card/60 hover:bg-card hover:border-primary/20 transition-all space-y-1"
                      >
                        <p className="font-mono text-xs font-bold text-primary truncate">
                          {tool.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          {tool.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center select-none">
                      <Code className="size-6 text-zinc-400 dark:text-zinc-650 mb-2" />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        No tools discovered yet. Run &quot;Test Connection&quot; to fetch them.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="space-y-8">
            {/* Quick Actions Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl p-5 space-y-4 ring-0 shadow-none">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Actions</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Configure, enable, or remove this server.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Plug className="size-4 text-muted-foreground" />
                    <span>Enabled</span>
                  </div>
                  <Switch
                    checked={mcp.isEnabled}
                    onCheckedChange={() => toggleMcp(mcp._id)}
                  />
                </div>

                <Link href={`/dashboard/connectors/mcps/${mcp._id}/edit`}>
                  <Button variant="outline" className="w-full h-10 font-bold text-sm rounded-full border border-zinc-150/60 dark:border-zinc-800 shadow-none uppercase tracking-wider">
                    <Settings className="mr-2 size-4" />
                    Configure
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  className="w-full h-10 font-bold text-sm rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 uppercase tracking-wider border border-destructive/20"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove Server
                </Button>
              </div>
            </Card>

            {/* Details Metadata Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardHeader className="pb-4 border-b border-zinc-150/60 dark:border-zinc-900/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <Server className="size-4 text-primary" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-150/60 dark:divide-zinc-900/60 p-0">
                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Globe className="size-3.5" />
                    <span>Transport</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase text-[10px]">
                    {mcp.transport}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Lock className="size-3.5" />
                    <span>Auth Type</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize">
                    {mcp.authType === "none" ? "None" : "OAuth 2.1"}
                  </span>
                </div>

                {mcp.authType === "oauth" && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Users className="size-3.5" />
                      <span>Auth Mode</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize">
                      {mcp.authMode === "owner" ? "Shared" : "Per-user"}
                    </span>
                  </div>
                )}

                {mcp.createdAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Created</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(mcp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {mcp.updatedAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Updated</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(mcp.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl p-5 space-y-3 ring-0 shadow-none">
              <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <Bot className="size-4 text-primary" />
                Used by Agents
              </h3>
              <p className="text-xs text-muted-foreground italic">
                Not assigned to any agents yet.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove MCP Server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{mcp?.name}</strong> connection
              configuration, unassign it from every agent, and remove any per-user connections.
              Agents expecting its tools to be active will fail during execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function McpDetailSkeleton() {
  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-64 rounded-2xl w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-56 rounded-2xl w-full" />
            <Skeleton className="h-40 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
