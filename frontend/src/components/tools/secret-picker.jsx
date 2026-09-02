"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { getProjectSecrets, createProjectSecret } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Picks an existing Project secret or creates a new one inline — the REST
 * API Tool Builder's Auth tab (PERSONA_REST_TOOL_REQUEST.md item 2).
 * `value` is the secret's id; the plaintext value is never displayed or
 * re-fetched here, only ever typed in once at creation.
 */
export function SecretPicker({ projectId, value, onChange }) {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getProjectSecrets(projectId);
        if (!cancelled) setSecrets(res.data?.data || []);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load secrets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCreate = async () => {
    if (!newLabel.trim() || !newValue.trim()) {
      toast.error("Label and value are required");
      return;
    }
    setSaving(true);
    try {
      const res = await createProjectSecret(projectId, {
        label: newLabel.trim(),
        value: newValue.trim(),
      });
      const created = res.data?.data;
      setSecrets((prev) => [...prev, created]);
      onChange(created.id);
      setCreating(false);
      setNewLabel("");
      setNewValue("");
      toast.success("Secret created.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create secret.");
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
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
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreating(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Create secret
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value || ""}
        onValueChange={(v) => onChange(v)}
        disabled={loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={loading ? "Loading secrets…" : "Select a secret"}
          />
        </SelectTrigger>
        <SelectContent>
          {secrets.map((secret) => (
            <SelectItem key={secret.id} value={secret.id}>
              {secret.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setCreating(true)}
      >
        <Plus className="mr-1.5 size-3.5" />
        New
      </Button>
    </div>
  );
}
