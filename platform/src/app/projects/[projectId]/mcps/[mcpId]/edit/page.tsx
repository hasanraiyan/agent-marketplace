"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockIcon,
  CopyIcon,
  FingerprintIcon,
  LinkIcon,
  LinkBreakIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import {
  getProjectMcps,
  updateProjectMcp,
  deleteProjectMcp,
  getProjectMcpUsage,
  getProjectMcpOwnerAuthorizeUrl,
  disconnectProjectMcpOwnerConnection,
} from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface McpTool {
  name: string;
  description?: string;
}

interface Mcp {
  _id?: string;
  id: string;
  name: string;
  description?: string;
  transport?: string;
  url: string;
  authType?: string;
  authMode?: string;
  oauth?: { clientId?: string; scopes?: string[]; dynamicallyRegistered?: boolean };
  isEnabled?: boolean;
  tools?: McpTool[];
  resources?: { uri: string; name?: string }[];
  lastTestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function EditMcpPage() {
  const { projectId, mcpId } = useParams<{ projectId: string; mcpId: string }>();
  const router = useRouter();
  const [mcp, setMcp] = React.useState<Mcp | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    transport: "http",
    url: "",
    authType: "none",
    authMode: "owner",
    apiKey: "",
    clientId: "",
    clientSecret: "",
    scopes: "",
    useDynamicRegistration: false,
    isEnabled: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [usage, setUsage] = React.useState<{ agentCount: number; agents: { _id: string; name: string }[] } | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [connectMessage, setConnectMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectMcps(projectId)
      .then((res) => {
        if (cancelled) return;
        const list: Mcp[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((m) => (m.id ?? m._id) === mcpId);
        if (!found) {
          setLoadError("MCP server not found.");
        } else {
          setMcp(found);
          setFormData({
            name: found.name || "",
            description: found.description || "",
            transport: found.transport || "http",
            url: found.url || "",
            authType: found.authType || "none",
            authMode: found.authMode || "owner",
            apiKey: "",
            clientId: found.oauth?.clientId || "",
            clientSecret: "",
            scopes: (found.oauth?.scopes || []).join(" "),
            useDynamicRegistration: !!found.oauth?.dynamicallyRegistered,
            isEnabled: found.isEnabled !== false,
          });
          getProjectMcpUsage(projectId, found.id ?? (found._id as string))
            .then((r) => {
              if (!cancelled) setUsage(r.data?.data ?? null);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load MCP server."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, mcpId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcp) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (formData.authType === "oauth" && !formData.useDynamicRegistration && !formData.clientId) {
        setSaveError("Client ID is required unless dynamic registration is enabled.");
        setSaving(false);
        return;
      }
      const data: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        transport: formData.transport,
        url: formData.url,
        authType: formData.authType,
        isEnabled: formData.isEnabled,
      };
      if (formData.authType === "apiKey" && formData.apiKey) data.apiKey = formData.apiKey;
      if (formData.authType === "oauth") {
        data.authMode = formData.authMode;
        data.useDynamicRegistration = formData.useDynamicRegistration;
        const oauth: Record<string, unknown> = {};
        if (formData.clientId) oauth.clientId = formData.clientId;
        if (formData.clientSecret) oauth.clientSecret = formData.clientSecret;
        if (formData.scopes.trim()) oauth.scopes = formData.scopes.split(/[\s,]+/).filter(Boolean);
        if (Object.keys(oauth).length > 0) data.oauth = oauth;
      }
      const targetId = mcp.id ?? mcp._id ?? mcpId;
      await updateProjectMcp(projectId, targetId, data);
      deleteCachedByPrefix(cacheKey.resource(projectId, "mcps"));
      router.push(`/projects/${projectId}/mcps`);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save MCP server."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mcp) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = mcp.id ?? mcp._id ?? mcpId;
      await deleteProjectMcp(projectId, targetId);
      deleteCachedByPrefix(cacheKey.resource(projectId, "mcps"));
      router.push(`/projects/${projectId}/mcps`);
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete MCP server. It may still be used by agents."));
      setDeleting(false);
    }
  };

  const handleConnect = async () => {
    if (!mcp) return;
    setConnecting(true);
    setConnectMessage(null);
    try {
      const targetId = mcp.id ?? mcp._id ?? mcpId;
      const res = await getProjectMcpOwnerAuthorizeUrl(projectId, targetId);
      const url = res.data?.data?.url || res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        setConnectMessage("No authorize URL returned.");
        setConnecting(false);
      }
    } catch (err) {
      setConnectMessage(errorMessage(err, "Failed to start authorization."));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!mcp) return;
    setDisconnecting(true);
    setConnectMessage(null);
    try {
      const targetId = mcp.id ?? mcp._id ?? mcpId;
      await disconnectProjectMcpOwnerConnection(projectId, targetId);
      setConnectMessage("Disconnected.");
    } catch (err) {
      setConnectMessage(errorMessage(err, "Failed to disconnect."));
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
          <Skeleton className="h-[560px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !mcp) {
    return (
      <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/mcps`} />}>MCP</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>MCP server not found</CardTitle>
            <CardDescription>{loadError ?? "This server does not exist."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/projects/${projectId}/mcps`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to MCP
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUsed = (usage?.agentCount ?? 0) > 0;
  const mcpIdDisplay = mcp.id ?? mcp._id ?? mcpId;
  const showOwnerConnect = formData.authType === "oauth" && formData.authMode === "owner";

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/mcps`} />}>MCP</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{mcp.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <PlugsConnectedIcon />
          </span>
          <span className="truncate">Edit MCP server</span>
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Leave API key or client secret blank to keep the current one.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Server configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} required minLength={2} maxLength={100} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} maxLength={500} rows={2} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="transport">Transport</FieldLabel>
                  <Select
                    value={formData.transport}
                    onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, transport: value ?? "http" }))}
                  >
                    <SelectTrigger id="transport">
                      <SelectValue placeholder="Select transport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP (streamable)</SelectItem>
                      <SelectItem value="sse">SSE</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="url">URL</FieldLabel>
                  <Input id="url" name="url" type="url" value={formData.url} onChange={handleChange} required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="authType">Authentication</FieldLabel>
                  <Select
                    value={formData.authType}
                    onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, authType: value ?? "none" }))}
                  >
                    <SelectTrigger id="authType">
                      <SelectValue placeholder="Select auth type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="apiKey">API key</SelectItem>
                      <SelectItem value="oauth">OAuth</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formData.authType === "apiKey" && (
                  <Field>
                    <FieldLabel htmlFor="apiKey">API key</FieldLabel>
                    <Input id="apiKey" name="apiKey" type="password" placeholder="••••••••••••••••" value={formData.apiKey} onChange={handleChange} />
                    <FieldDescription>Leave blank to keep the existing key.</FieldDescription>
                  </Field>
                )}

                {formData.authType === "oauth" && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="authMode">Who authorizes</FieldLabel>
                      <Select
                        value={formData.authMode}
                        onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, authMode: value ?? "owner" }))}
                      >
                        <SelectTrigger id="authMode">
                          <SelectValue placeholder="Select auth mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Project owner (shared connection)</SelectItem>
                          <SelectItem value="user">Each user (per-user connection)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useDynamicRegistration"
                        checked={formData.useDynamicRegistration}
                        onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, useDynamicRegistration: !!checked }))}
                      />
                      <div className="flex flex-col gap-0.5">
                        <label htmlFor="useDynamicRegistration" className="text-sm font-medium leading-none">
                          Use dynamic client registration
                        </label>
                        <p className="text-xs text-muted-foreground">Skip Client ID/Secret if the server supports RFC 7591.</p>
                      </div>
                    </div>

                    {!formData.useDynamicRegistration && (
                      <Field>
                        <FieldLabel htmlFor="clientId">Client ID</FieldLabel>
                        <Input id="clientId" name="clientId" value={formData.clientId} onChange={handleChange} required={!formData.useDynamicRegistration} />
                      </Field>
                    )}

                    <Field>
                      <FieldLabel htmlFor="clientSecret">Client secret</FieldLabel>
                      <Input id="clientSecret" name="clientSecret" type="password" placeholder="Leave blank to keep the existing secret" value={formData.clientSecret} onChange={handleChange} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="scopes">Scopes</FieldLabel>
                      <Input id="scopes" name="scopes" placeholder="e.g. read write" value={formData.scopes} onChange={handleChange} />
                      <FieldDescription>Space or comma separated.</FieldDescription>
                    </Field>
                  </>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isEnabled: !!checked }))}
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="isEnabled" className="text-sm font-medium leading-none">
                      Enabled
                    </label>
                    <p className="text-xs text-muted-foreground">Disabled servers are hidden from Agents without deleting them.</p>
                  </div>
                </div>
              </FieldGroup>

              {saveError && <FieldError>{saveError}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/mcps`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/mcps`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Update server"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {showOwnerConnect && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <LinkIcon className="size-4 text-muted-foreground" />
                  Owner connection
                </CardTitle>
                <CardDescription>Authorize once for the whole Project to use this server.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
                    <LinkIcon data-icon="inline-start" />
                    {connecting ? "Redirecting…" : "Connect"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    <LinkBreakIcon data-icon="inline-start" />
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </div>
                {connectMessage && <p className="text-xs text-muted-foreground">{connectMessage}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FingerprintIcon className="size-4 text-muted-foreground" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 divide-y divide-border text-xs">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FingerprintIcon className="size-3.5" />
                  ID
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="max-w-[140px] truncate font-mono text-[11px] sm:max-w-[180px]">{mcpIdDisplay}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(mcpIdDisplay);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <CopyIcon data-icon="inline-start" className={copied ? "text-primary" : undefined} />
                  </Button>
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Created
                </span>
                <span className="font-mono text-[11px]">{mcp.createdAt ? new Date(mcp.createdAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Last tested</span>
                <span className="font-mono text-[11px]">{mcp.lastTestedAt ? new Date(mcp.lastTestedAt).toLocaleString() : "Never"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={formData.isEnabled ? "default" : "outline"}>{formData.isEnabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            </CardContent>
          </Card>

          {mcp.tools && mcp.tools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PlugsConnectedIcon className="size-4 text-muted-foreground" />
                  Tools ({mcp.tools.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border text-xs">
                {mcp.tools.map((t) => (
                  <div key={t.name} className="flex flex-col gap-0.5 py-2">
                    <span className="font-mono font-medium">{t.name}</span>
                    {t.description && <span className="text-muted-foreground">{t.description}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PlugsConnectedIcon className="size-4 text-muted-foreground" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {usage ? (
                isUsed ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">Used by {usage.agentCount} agent(s):</p>
                    <ul className="flex list-disc flex-col gap-1 pl-4">
                      {usage.agents.map((a) => (
                        <li key={a._id} className="truncate">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not used by any agent.</p>
                )
              ) : (
                <p className="text-muted-foreground">Loading usage…</p>
              )}
            </CardContent>
          </Card>

          {isUsed && usage && (
            <Alert>
              <WarningCircleIcon />
              <AlertTitle>Used by {usage.agentCount} agent(s)</AlertTitle>
              <AlertDescription>{usage.agents.map((a) => a.name).join(", ")}. Update those agents before deleting.</AlertDescription>
            </Alert>
          )}

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <TrashIcon />
                Danger zone
              </CardTitle>
              <CardDescription>Deleting is blocked while agents still use this server.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError && <FieldError>{deleteError}</FieldError>}
              <Button variant="destructive" size="sm" className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white" onClick={() => setDeleteOpen(true)}>
                <TrashIcon data-icon="inline-start" />
                Delete server
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP server "{mcp.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {isUsed ? `This server is still used by ${usage?.agentCount} agent(s). Update those agents first.` : "Agents using this server will lose access to its tools."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
