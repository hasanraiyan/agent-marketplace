"use client";

import { useState } from "react";
import { useSkills } from "@/app/dashboard/skills/skills-context";
import {
  Server,
  Play,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  Terminal,
  Shield,
  HelpCircle,
  Globe,
  Database,
  Search,
  Folder,
  Eye,
  EyeOff,
  MessageSquare,
  Key,
  X,
  Code
} from "lucide-react";

const Github = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

const MCP_ICONS = {
  github: Github,
  search: Search,
  folder: Folder,
  database: Database,
  slack: MessageSquare,
  custom: Server
};

export function McpManager() {
  const {
    mcps,
    selectedMcpId,
    setSelectedMcpId,
    addMcp,
    updateMcp,
    deleteMcp,
    toggleMcp
  } = useSkills();

  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showValues, setShowValues] = useState({});

  // Editing/Creating form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEnv, setFormEnv] = useState([]); // [{key, value}]

  const activeMcp = mcps.find((m) => m.id === selectedMcpId);

  const handleStartEdit = () => {
    if (activeMcp) {
      setFormName(activeMcp.name);
      setFormDesc(activeMcp.description || "");
      setFormType(activeMcp.type || "stdio");
      setFormCommand(activeMcp.command || "");
      setFormArgs(activeMcp.args || "");
      setFormUrl(activeMcp.url || "");
      
      const envPairs = Object.entries(activeMcp.env || {}).map(([key, value]) => ({
        key,
        value
      }));
      setFormEnv(envPairs);
      setIsEditing(true);
      setIsCreating(false);
    }
  };

  const handleCreateNew = () => {
    setFormName("");
    setFormDesc("");
    setFormType("stdio");
    setFormCommand("");
    setFormArgs("");
    setFormUrl("");
    setFormEnv([]);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleAddEnvRow = () => {
    setFormEnv([...formEnv, { key: "", value: "" }]);
  };

  const handleRemoveEnvRow = (index) => {
    setFormEnv(formEnv.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index, field, value) => {
    const updated = [...formEnv];
    updated[index][field] = value;
    setFormEnv(updated);
  };

  const toggleShowValue = (key) => {
    setShowValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    if (!formName.trim()) {
      alert("Name is required");
      return;
    }

    const envObj = {};
    formEnv.forEach((pair) => {
      if (pair.key.trim()) {
        envObj[pair.key.trim()] = pair.value;
      }
    });

    const mcpData = {
      name: formName,
      description: formDesc,
      type: formType,
      command: formType === "stdio" ? formCommand : "",
      args: formType === "stdio" ? formArgs : "",
      url: formType === "sse" ? formUrl : "",
      env: envObj,
      icon: activeMcp?.icon || "custom"
    };

    if (isCreating) {
      const newId = addMcp({
        ...mcpData,
        isEnabled: false
      });
      setSelectedMcpId(newId);
      setIsCreating(false);
    } else {
      updateMcp(activeMcp.id, mcpData);
      setIsEditing(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (activeMcp) {
      deleteMcp(activeMcp.id);
      setShowDeleteDialog(false);
    }
  };

  const renderIcon = (iconName, className = "size-5") => {
    const IconComp = MCP_ICONS[iconName] || Server;
    return <IconComp className={className} />;
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0 animate-pulse">
            <Server className="size-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold truncate">Model Context Protocol</h1>
            <p className="text-xs text-muted-foreground truncate">
              Connect external databases, APIs, and CLI tools directly to your AI agents.
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                }}
              >
                <X className="size-4 mr-2" />
                Cancel
              </Button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Server Name</Label>
                <Input
                  id="mcp-name"
                  placeholder="e.g. SQLite database, Slack connector"
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
                <Label>Connection Type</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormType("stdio")}
                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all hover:bg-muted/50 ${
                      formType === "stdio"
                        ? "border-primary bg-primary/5 text-primary font-semibold ring-2 ring-primary/20"
                        : "border-muted"
                    }`}
                  >
                    <Terminal className="size-6" />
                    <span className="text-sm">Local Command (STDIO)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Runs node/python scripts or local binaries.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("sse")}
                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all hover:bg-muted/50 ${
                      formType === "sse"
                        ? "border-primary bg-primary/5 text-primary font-semibold ring-2 ring-primary/20"
                        : "border-muted"
                    }`}
                  >
                    <Globe className="size-6" />
                    <span className="text-sm">Remote SSE URL</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Connects to a hosted SSE server endpoint.
                    </span>
                  </button>
                </div>
              </div>

              {formType === "stdio" ? (
                <div className="space-y-4 border p-4 rounded-xl bg-muted/10">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Process Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="mcp-cmd">Executable / Cmd</Label>
                      <Input
                        id="mcp-cmd"
                        placeholder="npx, python, etc."
                        value={formCommand}
                        onChange={(e) => setFormCommand(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label htmlFor="mcp-args">Command Arguments</Label>
                      <Input
                        id="mcp-args"
                        placeholder="-y @modelcontextprotocol/server-postgres"
                        value={formArgs}
                        onChange={(e) => setFormArgs(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Environment Variables */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-muted-foreground">
                        Environment Variables
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={handleAddEnvRow}
                        className="h-7 text-[10px]"
                      >
                        <Plus className="size-3 mr-1" /> Add Row
                      </Button>
                    </div>
                    {formEnv.length > 0 ? (
                      <div className="space-y-2">
                        {formEnv.map((pair, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              placeholder="KEY"
                              className="font-mono text-xs h-8"
                              value={pair.key}
                              onChange={(e) => handleEnvChange(idx, "key", e.target.value)}
                            />
                            <Input
                              placeholder="VALUE"
                              type="password"
                              className="font-mono text-xs h-8"
                              value={pair.value}
                              onChange={(e) => handleEnvChange(idx, "value", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-8 w-8 hover:bg-destructive/10"
                              onClick={() => handleRemoveEnvRow(idx)}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        No custom variables set. Standard user context applies.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border p-4 rounded-xl bg-muted/10">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Server HTTP Endpoint
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="mcp-url">Server URL</Label>
                    <Input
                      id="mcp-url"
                      placeholder="https://my-mcp-server.com/sse"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setIsCreating(false); setIsEditing(false); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
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
                  {renderIcon(activeMcp.icon, "size-6 text-primary")}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{activeMcp.name}</h2>
                    <Badge
                      variant={activeMcp.isEnabled ? "success" : "outline"}
                      className={
                        activeMcp.isEnabled
                          ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"
                          : "text-muted-foreground"
                      }
                    >
                      {activeMcp.isEnabled ? (
                        <CheckCircle2 className="mr-1 size-3" />
                      ) : (
                        <XCircle className="mr-1 size-3" />
                      )}
                      {activeMcp.isEnabled ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {activeMcp.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Enable:</span>
                  <Switch
                    checked={activeMcp.isEnabled}
                    onCheckedChange={() => toggleMcp(activeMcp.id)}
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
                {/* Connection detail card */}
                <Card className="p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Connection Method
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-semibold capitalize">{activeMcp.type || "stdio"}</span>
                    </div>

                    {activeMcp.type === "stdio" ? (
                      <>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground font-semibold">Command Line Command:</span>
                          <div className="p-3 bg-muted rounded-lg font-mono text-xs flex items-center justify-between group">
                            <span className="truncate">{activeMcp.command} {activeMcp.args}</span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                            <Key className="size-3.5" /> Environment Variables
                          </span>
                          {Object.keys(activeMcp.env || {}).length > 0 ? (
                            <div className="border rounded-lg overflow-hidden divide-y text-xs font-mono">
                              {Object.entries(activeMcp.env).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-center p-2.5 bg-card">
                                  <span className="text-muted-foreground truncate pr-2">{key}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground">
                                      {showValues[key] ? val : "••••••••••••"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => toggleShowValue(key)}
                                    >
                                      {showValues[key] ? (
                                        <EyeOff className="size-3" />
                                      ) : (
                                        <Eye className="size-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No special credentials or environmental parameters configured.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground font-semibold">Server SSE URL:</span>
                        <div className="p-3 bg-muted rounded-lg font-mono text-xs truncate">
                          {activeMcp.url}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Info Disclaimer */}
                <div className="rounded-xl border border-dashed p-4 flex gap-3 bg-primary/5">
                  <Shield className="size-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">Security Boundary</p>
                    <p className="text-muted-foreground leading-relaxed">
                      MCP servers run in their own sandboxed sub-processes on the host platform. Only expose command directories, database access credentials, and slack API key scopes that you intend your agents to query or write to.
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
                  <Badge variant="secondary" className="rounded-full">
                    {activeMcp.tools?.length || 0}
                  </Badge>
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
                      No tools exposed by this server.
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
                  Model Context Protocol (MCP) is an open standard that allows secure connection between LLMs and your local or remote file hierarchies, postgres databases, CLI tools, and private APIs.
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
              <div className="shrink-0 size-24 bg-card rounded-2xl border flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <Server className="size-12 text-primary" />
              </div>
            </div>

            {/* Configured MCP Servers List or Empty State */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Configured MCP Servers
                </h3>
              </div>
              
              {mcps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mcps.map((mcp) => {
                    const isConfigured = mcp.isEnabled || Object.values(mcp.env || {}).some(v => v);
                    return (
                      <Card
                        key={mcp.id}
                        className="p-5 flex flex-col justify-between hover:border-primary/20 transition-all duration-300"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="rounded-lg bg-muted p-2 text-foreground">
                              {renderIcon(mcp.icon, "size-5 text-primary")}
                            </div>
                            {mcp.isEnabled ? (
                              <Badge variant="success" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                                Connected
                              </Badge>
                            ) : isConfigured ? (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/20">
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Disconnected
                              </Badge>
                            )}
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
                            variant={mcp.isEnabled ? "outline" : "default"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSelectedMcpId(mcp.id)}
                          >
                            {mcp.isEnabled ? "View Config" : "Setup Server"}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-10 flex flex-col items-center justify-center text-center bg-muted/5 min-h-[220px]">
                  <div className="rounded-full bg-muted p-4 text-muted-foreground/40 mb-4">
                    <Server className="size-8" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground mb-1">No MCP Servers Configured</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                    You haven't configured any local command-line executables or remote Server-Sent Event (SSE) endpoints yet.
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
              This will permanently delete the <strong>{activeMcp?.name}</strong> connection configuration. Any agents expecting its tools to be active will fail during execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
