"use client";

import { useState } from "react";
import { useConnectors } from "@/app/dashboard/connectors/connectors-context";
import { toast } from "sonner";
import {
  Server,
  Globe,
  Radio,
  Lock,
  Link2,
  Users,
  X,
  Save,
  Loader2,
  Info,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { useRouter } from "next/navigation";

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

export function McpEditor({ mcp, mode = "new" }) {
  const router = useRouter();
  const { createMcp, updateMcp } = useConnectors();

  const [formName, setFormName] = useState(mcp?.name || "");
  const [formDesc, setFormDesc] = useState(mcp?.description || "");
  const [formTransport, setFormTransport] = useState(mcp?.transport || "http");
  const [formUrl, setFormUrl] = useState(mcp?.url || "");
  const [formAuthType, setFormAuthType] = useState(mcp?.authType || "none");
  const [formAuthMode, setFormAuthMode] = useState(mcp?.authMode || "owner");
  const [formClientId, setFormClientId] = useState(mcp?.oauth?.clientId || "");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isCreating = mode === "new";

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
        router.push(`/dashboard/connectors/mcps/${created._id}`);
      } else {
        await updateMcp(mcp._id, payload);
        router.push(`/dashboard/connectors/mcps/${mcp._id}`);
      }
    } catch {
      // toasts are already shown by the context
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      router.push("/dashboard/connectors/mcps");
    } else {
      router.push(`/dashboard/connectors/mcps/${mcp._id}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Server className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{isCreating ? "Add MCP Server" : `Edit ${mcp?.name}`}</h1>
            <p className="text-xs text-muted-foreground">Configure a remote MCP server connection.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
            <X className="size-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            <Save className="size-4 mr-2" />
            {isCreating ? "Add Server" : "Save Changes"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-10 pb-20">
          {/* Section: General Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">General Information</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a name, description, and server URL for your MCP connector.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mcp-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Server Name
                  <Info className="size-3 ml-1 inline cursor-help" />
                </Label>
                <Input
                  id="mcp-name"
                  placeholder="e.g. Coursify, Linear, Notion"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="font-mono text-sm bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcp-desc" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="mcp-desc"
                  placeholder="What capabilities does this server expose?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="bg-muted/20 resize-none"
                />
              </div>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Connection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Connection</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure the transport protocol and endpoint URL.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transport</Label>
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
                <Label htmlFor="mcp-url" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Server URL
                </Label>
                <Input
                  id="mcp-url"
                  placeholder="https://my-mcp-server.com/api/mcp"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="font-mono text-sm bg-muted/20"
                />
              </div>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Authentication */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Authentication</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure how this server authenticates incoming requests.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Auth Type</Label>
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
                      <Label htmlFor="mcp-client-id" className="text-xs font-bold">Client ID</Label>
                      <Input
                        id="mcp-client-id"
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                        className="font-mono text-sm bg-muted/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mcp-client-secret" className="text-xs font-bold">Client Secret</Label>
                      <Input
                        id="mcp-client-secret"
                        type="password"
                        placeholder={!isCreating ? "Leave blank to keep current secret" : ""}
                        value={formClientSecret}
                        onChange={(e) => setFormClientSecret(e.target.value)}
                        className="font-mono text-sm bg-muted/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Who authenticates?</Label>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
