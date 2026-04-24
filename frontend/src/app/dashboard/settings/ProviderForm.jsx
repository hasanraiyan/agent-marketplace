"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createProvider,
  updateProvider,
  testProviderCredentials,
  getProviderModels,
} from "@/lib/api/providers";
import { toast } from "sonner";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

export function ProviderForm({ open, onOpenChange, provider, onSuccess }) {
  const isEditing = !!provider;
  const [formData, setFormData] = useState({
    label: "",
    baseURL: "",
    apiKey: "",
    defaultModel: "",
    isDefault: false,
  });
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (provider) {
      setFormData({
        label: provider.label || "",
        baseURL: provider.baseURL || "",
        apiKey: "", // empty for edit, will send placeholder logic backend
        defaultModel: provider.defaultModel || "",
        isDefault: provider.isDefault || false,
      });
      // Pre-fetch models for existing provider
      fetchModels(provider.id);
    } else {
      setFormData({
        label: "",
        baseURL: "",
        apiKey: "",
        defaultModel: "",
        isDefault: false,
      });
      setModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fetchModels = async (existingId = null) => {
    setLoadingModels(true);
    try {
      let res;
      if (
        existingId &&
        !formData.apiKey &&
        formData.baseURL === provider?.baseURL
      ) {
        // Fetch models using existing provider credentials on the backend
        res = await getProviderModels(existingId);
      } else {
        // Use provided baseURL and apiKey to test credentials and fetch models
        if (!formData.baseURL || !formData.apiKey) {
          toast.error(
            "Please provide both Base URL and API Key to fetch models.",
          );
          setLoadingModels(false);
          return;
        }
        res = await testProviderCredentials(formData.baseURL, formData.apiKey);
      }

      if (res?.data?.success) {
        const fetchedModels = res.data.data?.models || res.data.data;
        setModels(fetchedModels || []);
        toast.success("Models fetched successfully");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Failed to fetch models. Check your credentials.",
      );
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = { ...formData };

      if (isEditing && !dataToSubmit.apiKey) {
        delete dataToSubmit.apiKey; // don't send empty api key if editing
      }

      if (isEditing) {
        await updateProvider(provider.id, dataToSubmit);
        toast.success("Provider updated successfully");
      } else {
        await createProvider(dataToSubmit);
        toast.success("Provider created successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Provider" : "Add Provider"}
            </DialogTitle>
            <DialogDescription>
              Configure the connection details for your AI provider.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="label">Label</FieldLabel>
              <Input
                id="label"
                name="label"
                placeholder="e.g. My OpenAI"
                value={formData.label}
                onChange={handleChange}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="baseURL">Base URL</FieldLabel>
              <Input
                id="baseURL"
                name="baseURL"
                type="url"
                placeholder="https://api.openai.com/v1"
                value={formData.baseURL}
                onChange={handleChange}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder={isEditing ? "••••••••••••••••" : "sk-..."}
                value={formData.apiKey}
                onChange={handleChange}
                required={!isEditing}
              />
              {isEditing && (
                <FieldDescription>
                  Leave blank to keep existing key.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => fetchModels(isEditing ? provider.id : null)}
                  disabled={loadingModels}
                >
                  {loadingModels ? (
                    <Loader2Icon data-icon="inline-start" />
                  ) : (
                    <RefreshCwIcon data-icon="inline-start" />
                  )}
                  Fetch Models
                </Button>
              </div>

              <Select
                value={formData.defaultModel}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, defaultModel: value }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a default model" />
                </SelectTrigger>
                <SelectContent>
                  {models.length > 0 ? (
                    models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {formData.defaultModel
                        ? formData.defaultModel
                        : "No models fetched yet"}
                    </SelectItem>
                  )}
                  {models.length === 0 && formData.defaultModel && (
                    <SelectItem value={formData.defaultModel}>
                      {formData.defaultModel}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="isDefault"
                name="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isDefault: checked }))
                }
              />
              <FieldLabel htmlFor="isDefault">
                Set as default provider
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
