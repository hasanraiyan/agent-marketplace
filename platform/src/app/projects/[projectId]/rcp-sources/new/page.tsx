"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, InfoIcon, WrenchIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { createProjectRcpSource, getProjectSecrets } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

interface Secret {
  _id?: string;
  id: string;
  label: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function NewRcpSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    url: "",
    authType: "none",
    secretRef: "",
    isEnabled: true,
  });
  const [secrets, setSecrets] = React.useState<Secret[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getProjectSecrets(projectId)
      .then((res) => setSecrets(res.data?.data ?? []))
      .catch(() => setSecrets([]));
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = { ...formData };
      if (data.authType !== "header") delete data.secretRef;
      else if (!data.secretRef) {
        setError("Select a secret to send as the auth header.");
        setSaving(false);
        return;
      }
      if (!data.description) delete data.description;
      await createProjectRcpSource(projectId, data);
      deleteCachedByPrefix(cacheKey.resource(projectId, "rcp-sources"));
      router.push(`/projects/${projectId}/rcp-sources`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save RCP source."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/rcp-sources`} />}>RCP</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New source</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <WrenchIcon />
          </span>
          New RCP source
        </h1>
        <p className="max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">Register a REST Connector Protocol manifest URL to give Agents new tools.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-4 sm:gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Source configuration</CardTitle>
            <CardDescription>Point at an RCP manifest URL. Attach a header secret if the endpoint requires auth.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" placeholder="e.g. internal-crm" value={formData.name} onChange={handleChange} required minLength={2} maxLength={100} />
                  <FieldDescription>A friendly name for this source.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" placeholder="What does this source connect to?" value={formData.description} onChange={handleChange} maxLength={500} rows={2} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="url">Manifest URL</FieldLabel>
                  <Input id="url" name="url" type="url" placeholder="https://api.example.com/.well-known/rcp.json" value={formData.url} onChange={handleChange} required />
                  <FieldDescription>The RCP manifest URL an Agent's tools are discovered from.</FieldDescription>
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
                      <SelectItem value="header">Header (secret)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formData.authType === "header" && (
                  secrets && secrets.length === 0 ? (
                    <Alert>
                      <InfoIcon />
                      <AlertTitle>No secrets yet</AlertTitle>
                      <AlertDescription>
                        Create a secret first, then attach it here.{" "}
                        <Link href={`/projects/${projectId}/secrets/new`} className="underline underline-offset-4">
                          New secret
                        </Link>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="secretRef">Secret</FieldLabel>
                      <Select
                        value={formData.secretRef}
                        onValueChange={(value: string | null) => setFormData((prev) => ({ ...prev, secretRef: value ?? "" }))}
                      >
                        <SelectTrigger id="secretRef">
                          <SelectValue placeholder={secrets === null ? "Loading…" : "Select a secret"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(secrets ?? []).map((s) => (
                            <SelectItem key={s.id ?? s._id} value={(s.id ?? s._id) as string}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>Sent as an auth header on every request to this source.</FieldDescription>
                    </Field>
                  )
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
                    <p className="text-xs text-muted-foreground">Disabled sources are hidden from Agents without deleting them.</p>
                  </div>
                </div>
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/rcp-sources`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/rcp-sources`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create source"}
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
                <WrenchIcon className="size-4 text-muted-foreground" />
                How RCP sources work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>An RCP source points at a manifest describing REST endpoints an Agent can call as tools.</p>
              <p>Test the connection after creating to discover and cache the tools it exposes.</p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>Header auth sends a Project Secret&apos;s value on every request.</li>
                <li>Disabled sources stay configured but are hidden from Agents.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
