"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Play } from "lucide-react";
import {
  getProjectRcpSources,
  createProjectRcpSource,
  updateProjectRcpSource,
  testProjectRcpSource,
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
import { SecretPicker } from "@/components/tools/secret-picker";
import { ContextParamMapper } from "@/components/tools/context-param-mapper";

/**
 * RCP (REST Connector Protocol, npm `rcp-sdk`) Source editor — mirrors
 * ProjectRestToolSourceEditorPage's structure exactly, independent of it.
 * Two differences: auth is `none`/`header` only (not `apiKey` — matches
 * `rcp-sdk`'s actually-implemented auth modes), and the copy talks about
 * RCP rather than REST Tool Sources.
 */
export default function ProjectRcpSourceEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const sourceId = params.sourceId;
  const isEditing = sourceId !== "new";
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    authType: "none",
    secretRef: null,
    isEnabled: true,
    paramContextMap: [],
  });
  const [discoveredTools, setDiscoveredTools] = useState([]);
  const [lastTestedAt, setLastTestedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit RCP Source" : "Add RCP Source",
    description:
      "Register a hosted RCP manifest URL — Persona discovers your code-defined tools from it live, via the open rcp-sdk package.",
    actions: (
      <Link
        href={developerRoutes.project(projectId)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
    ),
  });

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const res = await getProjectRcpSources(projectId);
        const sources = res.data?.data || [];
        const source = sources.find((s) => (s._id || s.id) === sourceId);
        if (source) {
          setFormData({
            name: source.name || "",
            description: source.description || "",
            url: source.url || "",
            authType: source.authType || "none",
            secretRef: source.secretRef || null,
            isEnabled: source.isEnabled !== false,
            paramContextMap: source.paramContextMap || [],
          });
          setDiscoveredTools(source.tools || []);
          setLastTestedAt(source.lastTestedAt || null);
        } else {
          toast.error("RCP source not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load RCP source.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, sourceId, isEditing, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.authType === "header" && !formData.secretRef) {
      toast.error("Select or create a secret for header auth");
      return;
    }
    setSaving(true);
    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || undefined,
        url: formData.url,
        authType: formData.authType,
        isEnabled: formData.isEnabled,
        paramContextMap: formData.paramContextMap,
        ...(formData.authType === "header"
          ? { secretRef: formData.secretRef }
          : {}),
      };

      if (isEditing) {
        await updateProjectRcpSource(projectId, sourceId, dataToSubmit);
        toast.success("RCP source updated.");
      } else {
        await createProjectRcpSource(projectId, dataToSubmit);
        toast.success("RCP source created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save RCP source.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await testProjectRcpSource(projectId, sourceId);
      const tools = res.data?.data?.tools || [];
      setDiscoveredTools(tools);
      setLastTestedAt(new Date().toISOString());
      toast.success(
        `Connected — discovered ${tools.length} tool${tools.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Test Connection failed.");
    } finally {
      setTesting(false);
    }
  };

  // paramContextMap is keyed purely by param NAME (matches rcp-sdk's own
  // resolvers map), not by (tool, param) — so a name shared by two tools is
  // one mapping row here, not two. De-dupe across every discovered tool's
  // param list, first-seen description wins.
  const uniqueParams = useMemo(() => {
    const seen = new Map();
    for (const tool of discoveredTools) {
      for (const param of tool.params || []) {
        if (!seen.has(param.name)) seen.set(param.name, param);
      }
    }
    return Array.from(seen.values());
  }, [discoveredTools]);

  const handleParamContextChange = (paramName, contextKey) => {
    setFormData((prev) => {
      const rest = prev.paramContextMap.filter(
        (entry) => entry.param !== paramName,
      );
      const trimmed = contextKey.trim();
      return {
        ...prev,
        // An emptied field un-maps the param (back to model-fillable) rather
        // than persisting a mapping to an empty context key.
        paramContextMap: trimmed
          ? [...rest, { param: paramName, contextKey: trimmed }]
          : rest,
      };
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>RCP Source Configuration</CardTitle>
            <CardDescription>
              A URL your own backend hosts (e.g. via{" "}
              <code>@personaai/runtime</code>&apos;s <code>rcpManifest</code>{" "}
              option, or any server built with <code>rcp-sdk/server</code>),
              describing RCP tools your Agents can call — discovered live, the
              same way an MCP server&apos;s tools are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Weather Co"
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
                  placeholder="What tools does this source expose?"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="url">Manifest URL</FieldLabel>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://your-app.com/api/persona/rcp/manifest"
                  value={formData.url}
                  onChange={handleChange}
                  required
                  className="font-mono text-sm"
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
                    <SelectItem value="header">
                      Header (bearer token)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {formData.authType === "header" && (
                <Field>
                  <FieldLabel>Secret</FieldLabel>
                  <SecretPicker
                    projectId={projectId}
                    value={formData.secretRef}
                    onChange={(secretId) =>
                      setFormData((p) => ({ ...p, secretRef: secretId }))
                    }
                  />
                  <FieldDescription>
                    Same Secrets tab REST API Tools use. Sent as{" "}
                    <code>Authorization: Bearer &lt;value&gt;</code> on every
                    manifest fetch and every tool call — must match the{" "}
                    <code>authToken</code> your server is configured with.
                  </FieldDescription>
                </Field>
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

            {isEditing && (
              <div className="mt-8 space-y-4 border-t pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      Discovered Tools
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lastTestedAt
                        ? `Last tested ${new Date(lastTestedAt).toLocaleString()} — fetched live on every Agent invocation.`
                        : "Click Test Connection to fetch live tools from this manifest."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="self-start sm:self-auto gap-1.5"
                  >
                    {testing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Test Connection
                  </Button>
                </div>

                {discoveredTools.length > 0 ? (
                  <div className="grid gap-2.5">
                    {discoveredTools.map((tool, idx) => (
                      <div
                        key={`${tool.name}-${idx}`}
                        className="rounded-lg border bg-card p-3 text-sm space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`shrink-0 font-mono text-xs font-semibold ${
                                tool.method === "POST"
                                  ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5"
                                  : tool.method === "DELETE"
                                    ? "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5"
                                    : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                              }`}
                            >
                              {tool.method || "RCP"}
                            </Badge>
                            <span className="font-mono font-medium text-foreground">
                              {tool.name}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono"
                          >
                            {(tool.params || []).length} param
                            {(tool.params || []).length === 1 ? "" : "s"}
                          </Badge>
                        </div>

                        {tool.description && (
                          <p className="text-xs text-muted-foreground">
                            {tool.description}
                          </p>
                        )}

                        {tool.params && tool.params.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                            {tool.params.map((p) => {
                              const isMapped = formData.paramContextMap.some(
                                (m) => m.param === p.name,
                              );
                              return (
                                <span
                                  key={p.name}
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono border ${
                                    isMapped
                                      ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                      : "bg-muted/40 border-border text-muted-foreground"
                                  }`}
                                  title={
                                    isMapped
                                      ? `Resolved from context: ${formData.paramContextMap.find((m) => m.param === p.name)?.contextKey}`
                                      : `${p.type || "string"} ${p.required ? "(required)" : "(optional)"}`
                                  }
                                >
                                  {p.name}
                                  <span className="text-[9px] opacity-70">
                                    :{p.type || "str"}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-xs text-muted-foreground mb-3">
                      No tools discovered yet. Run Test Connection to discover
                      tools from this manifest.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="gap-1.5"
                    >
                      {testing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      Discover Tools Live
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isEditing && uniqueParams.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <ContextParamMapper
                  params={uniqueParams}
                  paramContextMap={formData.paramContextMap}
                  onChange={(newMap) =>
                    setFormData((prev) => ({
                      ...prev,
                      paramContextMap: newMap,
                    }))
                  }
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving} className="shadow-sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Source" : "Create Source"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
