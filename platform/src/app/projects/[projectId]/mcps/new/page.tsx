"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlugsConnectedIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { createProjectMcp } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function NewMcpPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
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
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (formData.authType === "oauth" && !formData.useDynamicRegistration && !formData.clientId) {
        setError("Client ID is required unless dynamic registration is enabled.");
        setSaving(false);
        return;
      }
      if (formData.authType === "apiKey" && !formData.apiKey) {
        setError("API key is required for API key auth.");
        setSaving(false);
        return;
      }
      const data: Record<string, unknown> = {
        name: formData.name,
        transport: formData.transport,
        url: formData.url,
        authType: formData.authType,
        isEnabled: formData.isEnabled,
      };
      if (formData.description) data.description = formData.description;
      if (formData.authType === "apiKey") data.apiKey = formData.apiKey;
      if (formData.authType === "oauth") {
        data.authMode = formData.authMode;
        data.useDynamicRegistration = formData.useDynamicRegistration;
        if (formData.clientId) data.oauth = { ...(data.oauth as object), clientId: formData.clientId };
        if (formData.clientSecret) data.oauth = { ...(data.oauth as object), clientSecret: formData.clientSecret };
        if (formData.scopes.trim()) {
          data.oauth = { ...(data.oauth as object), scopes: formData.scopes.split(/[\s,]+/).filter(Boolean) };
        }
      }
      await createProjectMcp(projectId, data);
      deleteCachedByPrefix(cacheKey.resource(projectId, "mcps"));
      router.push(`/projects/${projectId}/mcps`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save MCP server."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/mcps`} />}>MCP</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New server</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <PlugsConnectedIcon />
          </span>
          New MCP server
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Register a Model Context Protocol server to give Agents new tools.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Server configuration</CardTitle>
            <CardDescription>Point at an MCP server endpoint and choose how Agents authenticate to it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" placeholder="e.g. linear-mcp" value={formData.name} onChange={handleChange} required minLength={2} maxLength={100} />
                  <FieldDescription>A friendly name for this server.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" placeholder="What does this server give Agents access to?" value={formData.description} onChange={handleChange} maxLength={500} rows={2} />
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
                  <Input id="url" name="url" type="url" placeholder="https://mcp.example.com/mcp" value={formData.url} onChange={handleChange} required />
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
                    <Input id="apiKey" name="apiKey" type="password" placeholder="sk-..." value={formData.apiKey} onChange={handleChange} required />
                    <FieldDescription>Stored encrypted and never returned.</FieldDescription>
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
                      <FieldDescription>Owner mode connects once for the whole Project. User mode has each person authorize their own account.</FieldDescription>
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
                      <Input id="clientSecret" name="clientSecret" type="password" placeholder="Optional for public clients (PKCE)" value={formData.clientSecret} onChange={handleChange} />
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

              {error && <FieldError>{error}</FieldError>}

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
                    {saving ? "Creating…" : "Create server"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PlugsConnectedIcon className="size-4 text-muted-foreground" />
                How MCP servers work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>MCP servers expose tools, resources, and prompts an Agent can use over the Model Context Protocol.</p>
              <p>For OAuth servers with owner mode, you&apos;ll authorize the connection from the server&apos;s edit page after creating it.</p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>API keys and client secrets are encrypted at rest and never returned.</li>
                <li>Disabled servers stay configured but are hidden from Agents.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
