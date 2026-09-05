"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Play } from "lucide-react";
import {
  getProjectRestToolSources,
  createProjectRestToolSource,
  updateProjectRestToolSource,
  testProjectRestToolSource,
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

export default function ProjectRestToolSourceEditorPage({
  params: paramsPromise,
}) {
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
    apiKey: "",
    isEnabled: true,
  });
  const [discoveredTools, setDiscoveredTools] = useState([]);
  const [lastTestedAt, setLastTestedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit REST Tool Source" : "Add REST Tool Source",
    description:
      "Register a hosted manifest URL — Persona pulls your code-defined REST tools from it, the same way it discovers an MCP server.",
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
        const res = await getProjectRestToolSources(projectId);
        const sources = res.data?.data || [];
        const source = sources.find((s) => (s._id || s.id) === sourceId);
        if (source) {
          setFormData({
            name: source.name || "",
            description: source.description || "",
            url: source.url || "",
            authType: source.authType || "none",
            apiKey: "",
            isEnabled: source.isEnabled !== false,
          });
          setDiscoveredTools(source.tools || []);
          setLastTestedAt(source.lastTestedAt || null);
        } else {
          toast.error("REST Tool Source not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load REST Tool Source.",
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
    setSaving(true);
    try {
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || undefined,
        url: formData.url,
        authType: formData.authType,
        isEnabled: formData.isEnabled,
      };
      if (formData.authType === "apiKey" && formData.apiKey) {
        dataToSubmit.apiKey = formData.apiKey;
      }

      if (isEditing) {
        await updateProjectRestToolSource(projectId, sourceId, dataToSubmit);
        toast.success("REST Tool Source updated.");
      } else {
        await createProjectRestToolSource(projectId, dataToSubmit);
        toast.success("REST Tool Source created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save REST Tool Source.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await testProjectRestToolSource(projectId, sourceId);
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
            <CardTitle>REST Tool Source Configuration</CardTitle>
            <CardDescription>
              A URL your own backend hosts (e.g. via{" "}
              <code>@personaai/runtime</code>&apos;s{" "}
              <code>restToolsManifest</code> option), describing REST tools your
              Agents can call — discovered the same way an MCP server&apos;s
              tools are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Coursify"
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
                  placeholder="https://your-app.com/api/persona/rest-tools/manifest"
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
                    <SelectItem value="apiKey">API Key</SelectItem>
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
                      : "Sent as “Authorization: Bearer <key>” on every manifest fetch — must match the authToken your runtime is configured with."}
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
              <div className="mt-8 space-y-3 border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Discovered tools</p>
                    <p className="text-sm text-muted-foreground">
                      {lastTestedAt
                        ? `Last tested ${new Date(lastTestedAt).toLocaleString()} — fetched live again on every Agent call, this list is just a preview.`
                        : "Run Test Connection to discover this source's tools."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Play className="mr-1.5 size-4" />
                    )}
                    Test Connection
                  </Button>
                </div>
                {discoveredTools.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {discoveredTools.map((tool, idx) => (
                      <div
                        key={`${tool.name}-${idx}`}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <Badge variant="outline" className="shrink-0 font-mono">
                          {tool.method}
                        </Badge>
                        <span className="font-medium">{tool.name}</span>
                        {tool.description && (
                          <span className="truncate text-muted-foreground">
                            — {tool.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tools discovered yet.
                  </p>
                )}
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
