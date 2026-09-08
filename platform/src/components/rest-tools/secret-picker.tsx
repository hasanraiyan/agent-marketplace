"use client";

import * as React from "react";
import { PlusIcon, SpinnerIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProjectSecrets, createProjectSecret } from "@/lib/api/projects";

interface Secret {
  _id?: string;
  id: string;
  label: string;
}

/**
 * Picks an existing Project secret or creates a new one inline — the REST
 * API Tool Builder's Auth tab. `value` is the secret's id; the plaintext
 * value is never displayed or re-fetched here, only ever typed in once at
 * creation.
 */
function SecretPicker({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string | null;
  onChange: (secretId: string) => void;
}) {
  const [secrets, setSecrets] = React.useState<Secret[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getProjectSecrets(projectId)
      .then((res) => {
        if (!cancelled) setSecrets(res.data?.data ?? []);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              "Failed to load secrets."
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCreate = async () => {
    if (!newLabel.trim() || !newValue.trim()) {
      setCreateError("Label and value are required");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const res = await createProjectSecret(projectId, {
        label: newLabel.trim(),
        value: newValue.trim(),
      });
      const created = res.data?.data as Secret;
      setSecrets((prev) => [...prev, created]);
      onChange(created.id ?? (created._id as string));
      setCreating(false);
      setNewLabel("");
      setNewValue("");
    } catch (err) {
      setCreateError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to create secret."
      );
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex flex-col gap-3 rounded-none border bg-muted/10 p-4">
        <Field>
          <FieldLabel htmlFor="new-secret-label">Label</FieldLabel>
          <Input
            id="new-secret-label"
            placeholder="e.g. Skilify shared secret"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-secret-value">Value</FieldLabel>
          <Input
            id="new-secret-value"
            type="password"
            placeholder="Paste the secret value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <FieldDescription>
            Sent as <code>Authorization: Bearer &lt;value&gt;</code> on every
            call to this tool. Never shown again after saving.
          </FieldDescription>
        </Field>
        {createError && <FieldError>{createError}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
            {saving && <SpinnerIcon className="size-3.5 animate-spin" />}
            Create secret
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={value ?? ""}
          onValueChange={(v) => v && onChange(v)}
          disabled={loading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loading ? "Loading secrets…" : "Select a secret"} />
          </SelectTrigger>
          <SelectContent>
            {secrets.map((secret) => (
              <SelectItem key={secret.id ?? secret._id} value={secret.id ?? (secret._id as string)}>
                {secret.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" className="size-3.5" />
          New
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export { SecretPicker };