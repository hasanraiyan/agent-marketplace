"use client";

import { useState, useEffect, useCallback } from "react";
import { useSkills } from "@/app/dashboard/skills/skills-context";
import { testMcp, getOwnerAuthorizeUrl } from "@/lib/api/mcps";
import { toast } from "sonner";
import {
  Server,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  Shield,
  Globe,
  Radio,
  Users,
  Lock,
  X,
  Code,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export function McpManager() {
  const {
    mcps,
    selectedMcpId,
    setSelectedMcpId,
    isCreatingMcp,
    setIsCreatingMcp,
    createMcp,
    updateMcp,
    deleteMcp,
    toggleMcp,
    refreshMcps,
  } = useSkills();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Editing/Creating form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTransport, setFormTransport] = useState("http");
  const [formUrl, setFormUrl] = useState("");
  const [formAuthType, setFormAuthType] = useState("none");
  const [formAuthMode, setFormAuthMode] = useState("owner");
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");

  const activeMcp = mcps.find((m) => m._id === selectedMcpId);
  const isCreating = isCreatingMcp;

  // Pick up the OAuth callback redirect (?mcpId=&connected=owner or ?error=)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const mcpId = params.get("mcpId");
    const error = params.get("error");

    if (connected === "owner" && mcpId) {
      setSelectedMcpId(mcpId);
      refreshMcps();
      toast.success("Connected successfully");
    } else if (error === "oauth_failed") {
      toast.error("OAuth connection failed. Please try again.");
    }

    if (connected || error || mcpId) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("mcpId");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormTransport("http");
    setFormUrl("");
    setFormAuthType("none");
    setFormAuthMode("owner");
    setFormClientId("");
    setFormClientSecret("");
  };

  const handleStartEdit = () => {
    if (activeMcp) {
      setFormName(activeMcp.name);
      setFormDesc(activeMcp.description || "");
      setFormTransport(activeMcp.transport || "http");
      setFormUrl(activeMcp.url || "");
      setFormAuthType(activeMcp.authType || "none");
      setFormAuthMode(activeMcp.authMode || "owner");
      setFormClientId(activeMcp.oauth?.clientId || "");
      setFormClientSecret("");
      setIsEditing(true);
      setIsCreatingMcp(false);
    }
  };

  const handleCreateNew = () => {
    resetForm();
    setIsCreatingMcp(true);
    setIsEditing(false);
  };

  const handleCancelForm = () => {
    setIsCreatingMcp(false);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formUrl.trim()) {
      toast.error("Server URL is required");
      return;
    }
    if (formAuthType === "oauth" && !formClientId.trim()) {
      toast.error("Client ID is required for OAuth");
      return;
    }
    if (formAuthType === "oauth" && isCreating && !formClientSecret.trim()) {
      toast.error("Client Secret is required for OAuth");
      return;
    }

    const payload = {
      name: formName,
      description: formDesc,
      transport: formTransport,
      url: formUrl,
      authType: formAuthType,
      authMode: formAuthMode,
      ...(formAuthType === "oauth"
        ? {
            oauth: {
              clientId: formClientId,
              ...(formClientSecret.trim() ? { clientSecret: formClientSecret } : {}),
            },
          }
        : {}),
    };

    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await createMcp(payload);
        setSelectedMcpId(created._id);
        setIsCreatingMcp(false);
      } else {
        await updateMcp(activeMcp._id, payload);
        setIsEditing(false);
      }
    } catch {
      // toasts are already shown by the context
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (activeMcp) {
      await deleteMcp(activeMcp._id);
      setShowDeleteDialog(false);
    }
  };

  const handleTestConnection = useCallback(async () => {
    if (!activeMcp) return;
    setIsTesting(true);
    try {
      const res = await testMcp(activeMcp._id);
      const tools = res.data?.data || [];
      await refreshMcps();
      toast.success(`Connection successful — ${tools.length} tool(s) found`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  }, [activeMcp, refreshMcps]);

  const handleConnectOwner = useCallback(async () => {
    if (!activeMcp) return;
    setIsConnecting(true);
    try {
      const res = await getOwnerAuthorizeUrl(activeMcp._id);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start OAuth connection");
      setIsConnecting(false);
    }
  }, [activeMcp]);

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Server className="size-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold truncate">Model Context Protocol</h1>
            <p className="text-xs text-muted-foreground truncate">
              Connect remote MCP servers to extend your agents&apos; capabilities.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && !isCreating && (
            <Button size="sm" onClick={handleCreateNew}>
              <Plus className="size-4 mr-2" />
              Add Server
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isCreating || isEditing ? (
          <div className="max-w-3xl mx-auto p-6 space-y-8 pb-20">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold">
                {isCreating ? "Register New MCP Server" : `Edit ${formName}`}
              </h2>
              <Button variant="ghost" size="sm" onClick={handleCancelForm}>
                <X className="size-4 mr-2" />
                Cancel
              </Button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Server Name</Label>
                <Input
                  id="mcp-name"
                  placeholder="e.g. Coursify, Linear, Notion"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcp-desc">Description</Label>
                <Textarea
                  id="mcp-desc"
                  placeholder="What capabilities does this server expose?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Transport</Label>
                <div className="grid grid-cols-2 gap-4">
                  <SelectCard
                    active={formTransport === "http"}
                    onClick={() => setFormTransport("http")}
                    icon={Globe}
                    title="Streamable HTTP"
                    subtitle="Standard remote MCP transport."
                  />
                  <SelectCard
                    active={formTransport === "sse"}
                    onClick={() => setFormTransport("sse")}
                    icon={Radio}
                    title="Server-Sent Events"
                    subtitle="Legacy SSE transport."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcp-url">Server URL</Label>
                <Input
                  id="mcp-url"
                  placeholder="https://my-mcp-server.com/api/mcp"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Authentication</Label>
                <div className="grid grid-cols-2 gap-4">
                  <SelectCard
                    active={formAuthType === "none"}
                    onClick={() => setFormAuthType("none")}
                    icon={Globe}
                    title="None"
                    subtitle="Open access, no credentials."
                  />
                  <SelectCard
                    active={formAuthType === "oauth"}
                    onClick={() => setFormAuthType("oauth")}
                    icon={Lock}
                    title="OAuth 2.1"
                    subtitle="Client ID + Secret, PKCE flow."
                  />
                </div>
              </div>

              {formAuthType === "oauth" && (
                <div className="space-y-5 border p-4 rounded-xl bg-muted/10">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    OAuth Credentials
                  </h3>
                  <p className="text-[11px] text-muted-foreground -mt-3">
                    Authorization and token endpoints are auto-discovered from the server&apos;s{" "}
                    <code>/.well-known</code> metadata. Dynamic Client Registration isn&apos;t used —
                    enter the Client ID/Secret you registered manually with the server.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mcp-client-id">Client ID</Label>
                      <Input
                        id="mcp-client-id"
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mcp-client-secret">Client Secret</Label>
                      <Input
                        id="mcp-client-secret"
                        type="password"
                        placeholder={!isCreating ? "Leave blank to keep current secret" : ""}
                        value={formClientSecret}
                        onChange={(e) => setFormClientSecret(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label>Who authenticates?</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectCard
                        active={formAuthMode === "owner"}
                        onClick={() => setFormAuthMode("owner")}
                        icon={Link2}
                        title="Shared — you connect once"
                        subtitle="Every user of an agent using this connector shares your connection."
                      />
                      <SelectCard
                        active={formAuthMode === "user"}
                        onClick={() => setFormAuthMode("user")}
                        icon={Users}
                        title="Per-user"
                        subtitle="Each user connects their own account before using its tools."
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCancelForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Save Server
                </Button>
              </div>
            </div>
          </div>
        ) : activeMcp ? (
          <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
            {/* Header / Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
              <div className="flex gap-4 items-start">
                <div className="rounded-xl border bg-muted p-3 text-foreground shrink-0 shadow-sm">
                  <Server className="size-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{activeMcp.name}</h2>
                    <StatusBadge mcp={activeMcp} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {activeMcp.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Enabled:</span>
                  <Switch
                    checked={activeMcp.isEnabled}
                    onCheckedChange={() => toggleMcp(activeMcp._id)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Settings className="size-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Settings / Specs */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Connection
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                    >
                      {isTesting && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                      Test Connection
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="text-muted-foreground">Transport:</span>
                      <span className="font-semibold uppercase">{activeMcp.transport}</span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground font-semibold">Server URL:</span>
                      <div className="p-3 bg-muted rounded-lg font-mono text-xs truncate">
                        {activeMcp.url}
                      </div>
                    </div>

                    {activeMcp.authType === "oauth" ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="text-muted-foreground">Client ID:</span>
                          <span className="font-mono text-xs">{activeMcp.oauth?.clientId}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="text-muted-foreground">Client Secret:</span>
                          <span className="font-mono text-xs">
                            {activeMcp.oauth?.hasClientSecret ? "••••••••••••" : "Not set"}
                          </span>
                        </div>

                        {activeMcp.authMode === "owner" ? (
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 text-sm">
                              {activeMcp.oauth?.ownerConnected ? (
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
                              variant={activeMcp.oauth?.ownerConnected ? "outline" : "default"}
                              onClick={handleConnectOwner}
                              disabled={isConnecting}
                            >
                              {isConnecting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                              {activeMcp.oauth?.ownerConnected ? "Reconnect" : "Connect"}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic pt-2">
                            Per-user authentication: each user of an agent using this connector
                            will be prompted to connect their own account before its tools become
                            available to them.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pt-2">
                        No authentication — this server accepts requests without credentials.
                      </p>
                    )}
                  </div>
                </Card>

                <div className="rounded-xl border border-dashed p-4 flex gap-3 bg-primary/5">
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
              </div>

              {/* Tools Exported */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Code className="size-3.5 text-primary" /> Tools Exchanged
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-full">
                      {activeMcp.tools?.length || 0}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Refresh tools"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                    >
                      <RefreshCw className={`size-3.5 ${isTesting ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {activeMcp.tools && activeMcp.tools.length > 0 ? (
                    activeMcp.tools.map((tool) => (
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
                    <p className="text-xs text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">
                      No tools discovered yet. Run &quot;Test Connection&quot; to fetch them.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-6 space-y-10 pb-20">
            {/* Overview / Banner */}
            <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2 max-w-xl text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Extend agents with Model Context Protocol
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Model Context Protocol (MCP) is an open standard that connects LLMs to remote
                  APIs and tools over Streamable HTTP or SSE, optionally protected by OAuth 2.1.
                </p>
                <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                  <a
                    href="https://modelcontextprotocol.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    Read MCP Specification <ArrowRight className="size-3" />
                  </a>
                </div>
              </div>
              <div className="shrink-0 size-24 bg-card rounded-2xl border flex items-center justify-center shadow-lg">
                <Server className="size-12 text-primary" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Configured MCP Servers
                </h3>
              </div>

              {mcps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mcps.map((mcp) => (
                    <Card
                      key={mcp._id}
                      className="p-5 flex flex-col justify-between hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="rounded-lg bg-muted p-2 text-foreground">
                            <Server className="size-5 text-primary" />
                          </div>
                          <StatusBadge mcp={mcp} />
                        </div>

                        <div>
                          <h4 className="font-bold text-sm">{mcp.name}</h4>
                          {mcp.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                              {mcp.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-4 mt-4">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Code className="size-3" />
                          <span>{mcp.tools?.length || 0} tools</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setSelectedMcpId(mcp._id)}
                        >
                          View Config
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-10 flex flex-col items-center justify-center text-center bg-muted/5 min-h-[220px]">
                  <div className="rounded-full bg-muted p-4 text-muted-foreground/40 mb-4">
                    <Server className="size-8" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground mb-1">No MCP Servers Configured</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                    You haven&apos;t connected any remote HTTP or SSE MCP servers yet.
                  </p>
                  <Button size="sm" onClick={handleCreateNew}>
                    <Plus className="size-4 mr-2" />
                    Add MCP Server
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove MCP Server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{activeMcp?.name}</strong> connection
              configuration, unassign it from every agent, and remove any per-user connections.
              Agents expecting its tools to be active will fail during execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SelectCard({ active, onClick, icon: Icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 border rounded-xl flex flex-col items-center gap-2 text-center transition-all hover:bg-muted/50 ${
        active
          ? "border-primary bg-primary/5 text-primary font-semibold ring-2 ring-primary/20"
          : "border-muted"
      }`}
    >
      <Icon className="size-6" />
      <span className="text-sm">{title}</span>
      <span className="text-[10px] text-muted-foreground font-normal">{subtitle}</span>
    </button>
  );
}

function StatusBadge({ mcp }) {
  if (!mcp.isEnabled) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Disabled
      </Badge>
    );
  }

  if (mcp.authType === "oauth" && mcp.authMode === "user") {
    return (
      <Badge variant="outline" className="text-sky-600 border-sky-500/20">
        <Users className="mr-1 size-3" />
        Per-user auth
      </Badge>
    );
  }

  if (mcp.authType === "oauth" && mcp.authMode === "owner") {
    return mcp.oauth?.ownerConnected ? (
      <Badge
        variant="success"
        className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"
      >
        <CheckCircle2 className="mr-1 size-3" />
        Connected
      </Badge>
    ) : (
      <Badge variant="outline" className="text-amber-500 border-amber-500/20">
        Needs Connection
      </Badge>
    );
  }

  return (
    <Badge
      variant="success"
      className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"
    >
      <CheckCircle2 className="mr-1 size-3" />
      Ready
    </Badge>
  );
}
