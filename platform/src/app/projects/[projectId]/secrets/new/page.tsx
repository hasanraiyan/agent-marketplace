"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon, LockKeyIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProjectSecret } from "@/lib/api/projects";

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
      router.push(`/projects/${projectId}/secrets`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create secret. Label may already exist."));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/projects/${projectId}/secrets`} />}>
        <ArrowLeftIcon />
        Back to secrets
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyIcon className="size-4 text-muted-foreground" />
            New secret
          </CardTitle>
          <CardDescription>
            Bearer token for the REST Tool Builder. The value is encrypted at rest and never
            returned again — you already have it once you type it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="secret-label">Label</FieldLabel>
              <Input
                id="secret-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Skilify shared secret"
                maxLength={100}
                autoFocus
                required
              />
              <FieldDescription>1–100 characters, unique per project.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="secret-value">Value</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="secret-value"
                  type={showValue ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Paste the secret value"
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowValue((v) => !v)}
                  aria-label={showValue ? "Hide value" : "Show value"}
                >
                  {showValue ? <EyeSlashIcon /> : <EyeIcon />}
                </Button>
              </div>
              <FieldDescription>The plaintext is encrypted with AES-256-GCM and never shown again.</FieldDescription>
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/secrets`)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !label.trim() || !value}>
                {submitting ? "Creating…" : "Create secret"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
