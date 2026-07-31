"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Link2, Link2Off } from "lucide-react";
import {
  getProjectMcps,
  createProjectMcp,
  updateProjectMcp,
  getProjectMcpOwnerAuthorizeUrl,
  disconnectProjectMcpOwnerConnection,
} from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectMcpEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const mcpId = params.mcpId;
  const isEditing = mcpId !== "new";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    transport: "http",
    url: "",
    authType: "none",
    authMode: "owner",
    useDynamicRegistration: false,
    clientId: "",
    clientSecret: "",
    apiKey: "",
    isEnabled: true,
  });
  const [ownerConnected, setOwnerConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit Connector" : "Add Connector",
    description: "Configure an MCP connector this Project owns.",
  });

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const res = await getProjectMcps(projectId);
        const mcps = res.data?.data || [];
        const mcp = mcps.find((m) => (m._id || m.id) === mcpId);
        if (mcp) {
          setFormData({
            name: mcp.name || "",
            description: mcp.description || "",
            transport: mcp.transport || "http",
            url: mcp.url || "",
            authType: mcp.authType || "none",
            authMode: mcp.authMode || "owner",
            useDynamicRegistration: mcp.oauth?.dynamicallyRegistered || false,
            clientId: mcp.oauth?.clientId || "",
            clientSecret: "",
            apiKey: "",
            isEnabled: mcp.isEnabled !== false,
          });
          setOwnerConnected(!!mcp.oauth?.ownerConnected);
        } else {
          toast.error("Connector not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Connector.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, mcpId, isEditing, router]);

  useEffect(() => {
    if (searchParams.get("connected") === "owner") {
      setOwnerConnected(true);
      toast.success("Owner account connected.");
    }
    if (searchParams.get("error") === "oauth_failed") {
      toast.error("OAuth connection failed. Try again.");
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || undefined,
        transport: formData.transport,
        url: formData.url,
        authType: formData.authType,
        authMode: formData.authMode,
        isEnabled: formData.isEnabled,
      };

      if (formData.authType === "oauth") {
        if (formData.useDynamicRegistration) {
          dataToSubmit.useDynamicRegistration = true;
        } else {
          dataToSubmit.oauth = { clientId: formData.clientId };
          if (formData.clientSecret) {
            dataToSubmit.oauth.clientSecret = formData.clientSecret;
          } else if (!isEditing) {
            dataToSubmit.oauth.clientSecret = "";
          }
        }
      } else if (formData.authType === "apiKey") {
        if (formData.apiKey) dataToSubmit.apiKey = formData.apiKey;
      }

      if (isEditing) {
        await updateProjectMcp(projectId, mcpId, dataToSubmit);
        toast.success("Connector updated.");
      } else {
        await createProjectMcp(projectId, dataToSubmit);
        toast.success("Connector created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Connector.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectOwner = async () => {
    setConnecting(true);
    try {
      const res = await getProjectMcpOwnerAuthorizeUrl(projectId, mcpId);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to start OAuth connection.",
      );
      setConnecting(false);
    }
  };

  const handleDisconnectOwner = async () => {
    setConnecting(true);
    try {
      await disconnectProjectMcpOwnerConnection(projectId, mcpId);
      setOwnerConnected(false);
      toast.success("Owner connection disconnected.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disconnect.");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href={developerRoutes.project(projectId)}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">
          {isEditing ? "Edit Connector" : "New Connector"}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Connector Configuration</CardTitle>
            <CardDescription>
              Connection details for this Project&apos;s MCP server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Internal Ticketing System"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  maxLength={100}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What can Agents do with this connector?"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="transport">Transport</FieldLabel>
                <Select
                  value={formData.transport}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, transport: value }))
                  }
                >
                  <SelectTrigger id="transport" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="url">Server URL</FieldLabel>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://mcp.example.com"
                  value={formData.url}
                  onChange={handleChange}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="authType">Authentication</FieldLabel>
                <Select
                  value={formData.authType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, authType: value }))
                  }
                >
                  <SelectTrigger id="authType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="apiKey">API Key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {formData.authType === "apiKey" && (
                <Field>
                  <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
                  <Input
                    id="apiKey"
                    name="apiKey"
                    type="password"
                    placeholder={
                      isEditing ? "••••••••••••••••" : "Enter API key"
                    }
                    value={formData.apiKey}
                    onChange={handleChange}
                    required={!isEditing}
                  />
                  <FieldDescription>
                    {isEditing
                      ? "Leave blank to keep the existing key."
                      : "Sent as this connector's authentication key."}
                  </FieldDescription>
                </Field>
              )}

              {formData.authType === "oauth" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="authMode">
                      Who authenticates
                    </FieldLabel>
                    <Select
                      value={formData.authMode}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, authMode: value }))
                      }
                    >
                      <SelectTrigger id="authMode" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          Shared (this Project connects once)
                        </SelectItem>
                        <SelectItem value="user">
                          Per-user (each of this Project&apos;s own users
                          connects their own account)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Per-user connections are made by this Project&apos;s own
                      end-users via the SDK, not from Studio.
                    </FieldDescription>
                  </Field>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Dynamic Client Registration
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Let the server auto-register a client instead of
                        entering credentials manually.
                      </p>
                    </div>
                    <Switch
                      checked={formData.useDynamicRegistration}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          useDynamicRegistration: checked,
                        }))
                      }
                    />
                  </div>

                  {!formData.useDynamicRegistration && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="clientId">Client ID</FieldLabel>
                        <Input
                          id="clientId"
                          name="clientId"
                          value={formData.clientId}
                          onChange={handleChange}
                          required={formData.authType === "oauth"}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="clientSecret">
                          Client Secret
                        </FieldLabel>
                        <Input
                          id="clientSecret"
                          name="clientSecret"
                          type="password"
                          placeholder={
                            isEditing ? "•••••••••••••" : "Enter client secret"
                          }
                          value={formData.clientSecret}
                          onChange={handleChange}
                          required={!isEditing && formData.authType === "oauth"}
                        />
                        <FieldDescription>
                          {isEditing
                            ? "Leave blank to keep the existing secret."
                            : ""}
                        </FieldDescription>
                      </Field>
                    </>
                  )}

                  {isEditing && formData.authMode === "owner" && (
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ownerConnected ? "outline" : "secondary"}
                        >
                          {ownerConnected ? "Connected" : "Not connected"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Shared owner account
                        </span>
                      </div>
                      {ownerConnected ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectOwner}
                          disabled={connecting}
                        >
                          <Link2Off className="mr-1.5 size-3.5" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleConnectOwner}
                          disabled={connecting}
                        >
                          <Link2 className="mr-1.5 size-3.5" />
                          Connect
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-sm text-muted-foreground">
                    Available for this Project&apos;s Agents to attach.
                  </p>
                </div>
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isEnabled: checked }))
                  }
                />
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Connector" : "Create Connector"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
