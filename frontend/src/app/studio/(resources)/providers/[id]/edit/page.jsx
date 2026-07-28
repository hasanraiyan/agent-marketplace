"use client";

import { studioRoutes } from "@/lib/studio-routes";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  getProviders,
} from "@/lib/api/providers";
import { toast } from "sonner";
import { Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProviderEditorPage({ params: paramsPromise }) {
  const router = useRouter();
  const params = React.use(paramsPromise);
  const id = params.id;
  const isEditing = id !== "new";

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
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit Provider" : "Add Provider",
    description: "Configure your AI provider credentials and models.",
  });

  useEffect(() => {
    if (isEditing) {
      const fetchProvider = async () => {
        try {
          const res = await getProviders();
          const providers = res.data?.data || [];
          const provider = providers.find((p) => p.id === id);
          if (provider) {
            setFormData({
              label: provider.label || "",
              baseURL: provider.baseURL || "",
              apiKey: "",
              defaultModel: provider.defaultModel || "",
              isDefault: provider.isDefault || false,
            });
            // Pre-fetch models for existing provider
            fetchModels(provider.id);
          } else {
            toast.error("Provider not found");
            router.push(studioRoutes.providers);
          }
        } catch (err) {
          toast.error("Failed to load provider");
        } finally {
          setLoading(false);
        }
      };
      fetchProvider();
    }
  }, [id, isEditing]);

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
        (isEditing && formData.baseURL)
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
        delete dataToSubmit.apiKey;
      }

      if (isEditing) {
        await updateProvider(id, dataToSubmit);
        toast.success("Provider updated successfully");
      } else {
        await createProvider(dataToSubmit);
        toast.success("Provider created successfully");
      }
      router.push(studioRoutes.providers);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href={studioRoutes.providers}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">
          {isEditing ? "Edit Provider" : "New Provider"}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>
              Enter the connection details for your OpenAI-compatible AI provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
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
                <FieldDescription>
                  A friendly name for this provider.
                </FieldDescription>
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
                <FieldDescription>
                  The API endpoint for the provider.
                </FieldDescription>
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
                <FieldDescription>
                  {isEditing
                    ? "Leave blank to keep existing key."
                    : "Your secret API key."}
                </FieldDescription>
              </Field>

              <Field>
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchModels(isEditing ? id : null)}
                    disabled={loadingModels}
                  >
                    {loadingModels ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3 w-3" />
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
                        {formData.defaultModel || "No models fetched yet"}
                      </SelectItem>
                    )}
                    {models.length === 0 && formData.defaultModel && (
                      <SelectItem value={formData.defaultModel}>
                        {formData.defaultModel}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  The model that will be used by default for this provider.
                </FieldDescription>
              </Field>

              <div className="flex items-center space-x-2 pt-4">
                <Checkbox
                  id="isDefault"
                  name="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isDefault: !!checked }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="isDefault"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Set as default provider
                  </label>
                  <p className="text-sm text-muted-foreground">
                    This provider will be used for new agents by default.
                  </p>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={studioRoutes.providers}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Provider" : "Create Provider"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
