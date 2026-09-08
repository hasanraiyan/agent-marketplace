"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon, InfoIcon, LockKeyIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { createProjectSecret } from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
  );
}

export default function NewSecretPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [value, setValue] = React.useState("");
  const [showValue, setShowValue] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !value) {
      setError("Label and value are required.");
      return;
    }
    if (trimmedLabel.length > 100) {
      setError("Label must be 1-100 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProjectSecret(projectId, { label: trimmedLabel, value });
      deleteCachedByPrefix(cacheKey.resource(projectId, "secrets"));
      router.push(`/projects/${projectId}/secrets`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create secret. Label may already exist."));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      {/* Breadcrumb + header — desktop uses full width, not centered */}
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/projects/${projectId}/secrets`} />}>Secrets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New secret</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
              <LockKeyIcon />
            </span>
            New secret
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Bearer token for the REST Tool Builder. The value is encrypted at rest with AES-256-GCM and never
            returned again — store it where your endpoint can verify it.
          </p>
        </div>
      </div>

      <Separator />

      {/* Desktop: 2-column grid — form 65%, help 35%. Mobile stacks. */}
      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        {/* Left: form */}
        <Card>
          <CardHeader>
            <CardTitle>Secret details</CardTitle>
            <CardDescription>Label is visible in the list and must be unique per project.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field data-invalid={!!error && !label.trim()}>
                  <FieldLabel htmlFor="secret-label">Label</FieldLabel>
                  <Input
                    id="secret-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Skilify shared secret"
                    maxLength={100}
                    autoFocus
                    required
                    aria-invalid={!!error && !label.trim()}
                  />
                  <FieldDescription>1–100 characters, unique per project. Renaming later is allowed.</FieldDescription>
                </Field>

                <Field data-invalid={!!error && !value}>
                  <FieldLabel htmlFor="secret-value">Value</FieldLabel>
                  <InputGroup data-invalid={!!error && !value}>
                    <InputGroupInput
                      id="secret-value"
                      type={showValue ? "text" : "password"}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Paste the secret value"
                      required
                      aria-invalid={!!error && !value}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowValue((v) => !v)}
                        aria-label={showValue ? "Hide value" : "Show value"}
                      >
                        {showValue ? <EyeSlashIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>The plaintext is encrypted and never shown again — not even right after creation.</FieldDescription>
                </Field>
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/secrets`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/projects/${projectId}/secrets`)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || !label.trim() || !value}>
                    {submitting ? "Creating…" : "Create secret"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right: help / context — stacks below on mobile */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                How secrets work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                A Project Secret is presented <span className="font-medium text-foreground">by Persona to your endpoint</span> on every REST Tool call — opposite direction from a Project Credential.
              </p>
              <p>
                Store the same value on your server and verify the incoming <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer &lt;secret&gt;</code> header.
              </p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>Value is AES-256-GCM encrypted at rest.</li>
                <li>Never returned by any GET — keep your copy safe.</li>
                <li>Rotate by editing the secret with a new value.</li>
              </ul>
            </CardContent>
          </Card>

          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              Use one secret per environment (prod / staging) and reference it from the REST Tool Builder&apos;s Auth tab. Deleting is blocked while tools still use it.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
