"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  DatabaseIcon,
  InfoIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { createProjectStore } from "@/lib/api/projects";

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

// Lowercase letters, numbers, hyphens only (matches the backend schema
// /^[a-z0-9-]+$/); every other character collapses into a hyphen so the
// field stays valid as you type.
const sanitizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");

export default function NewStorePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    scope: "domain",
    accessMode: "readwrite",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const storesHref = `/projects/${projectId}/stores`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProjectStore(projectId, formData);
      router.push(storesHref);
    } catch (err) {
      setError(errorMessage(err, "Failed to create store."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={storesHref} />}>Stores</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New store</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <DatabaseIcon />
          </span>
          New store
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A named, scoped mount point Agents can be assigned to via their storeMounts.
        </p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Store Configuration</CardTitle>
            <CardDescription>
              Content is populated separately via the API — this form only manages the Store&apos;s config.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. product-notes"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: sanitizeName(e.target.value) }))}
                    required
                    minLength={2}
                    maxLength={64}
                  />
                  <FieldDescription>
                    Lowercase letters, numbers, and hyphens only. Mounted at{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      /stores/{formData.name || "&lt;name&gt;"}/
                    </code>{" "}
                    in every Agent it&apos;s assigned to.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What does this Store hold, and why would an Agent read it?"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    maxLength={1024}
                    rows={2}
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="scope">Scope</FieldLabel>
                    <Select
                      value={formData.scope}
                      onValueChange={(value: string | null) =>
                        setFormData((prev) => ({ ...prev, scope: value ?? "domain" }))
                      }
                      required
                    >
                      <SelectTrigger id="scope">
                        <SelectValue placeholder="Select a scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domain">Domain — one shared copy for the whole Project</SelectItem>
                        <SelectItem value="externalUser">External user — one private copy per founder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Choose carefully — this cannot be changed after creation.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="accessMode">Access mode</FieldLabel>
                    <Select
                      value={formData.accessMode}
                      onValueChange={(value: string | null) =>
                        setFormData((prev) => ({ ...prev, accessMode: value ?? "readwrite" }))
                      }
                      required
                    >
                      <SelectTrigger id="accessMode">
                        <SelectValue placeholder="Select an access mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="readwrite">Read-write — Agents can also write to it</SelectItem>
                        <SelectItem value="readonly">Read-only — Agents can only read; edit content here</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Read-only stores are safe to assign to Agents serving many different founders.
                    </FieldDescription>
                  </Field>
                </div>
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={storesHref} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(storesHref)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create store"}
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
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                How Stores work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Stores are Project-scoped mount points. Agents attach to them via{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">storeMounts</code>{" "}
                on the Agent edit form.
              </p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>Domain scope shares one copy across every Agent run.</li>
                <li>External-user scope gives each external user a private copy.</li>
                <li>Scope is permanent — pick carefully.</li>
              </ul>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              Store content is written by Agents at runtime (or via the API) — this form only
              configures the mount point.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}