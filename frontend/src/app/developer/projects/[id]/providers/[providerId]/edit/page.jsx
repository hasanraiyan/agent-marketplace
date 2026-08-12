"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import {
  getProjectProviders,
  createProjectProvider,
  updateProjectProvider,
  getProjectProviderModels,
} from "@/lib/api/projects";
import { testProviderCredentials } from "@/lib/api/providers";
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
import { Skeleton } from "@/components/ui/skeleton";

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "Custom" },
];

export default function ProjectProviderEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const providerId = params.providerId;
  const isEditing = providerId !== "new";
  const router = useRouter();

  const [formData, setFormData] = useState({
    type: "",
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
    description: "Configure an AI provider this Project owns.",
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
        const res = await getProjectProviders(projectId);
        const providers = res.data?.data || [];
        const provider = providers.find((p) => p.id === providerId);
        if (provider) {
          setFormData({
            type: provider.type || "custom",
            label: provider.label || "",
            baseURL: provider.baseURL || "",
            apiKey: "",
            defaultModel: provider.defaultModel || "",
            isDefault: provider.isDefault || false,
          });
          fetchModels(provider.id);
        } else {
          toast.error("Provider not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Provider.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, providerId, isEditing, router]);

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
      if (existingId && !formData.apiKey && isEditing) {
        // Fetch models using this Project's saved provider credentials
        // (reads the saved provider's type/baseURL server-side — doesn't
        // need `formData.type`, which may still be stale right after the
        // load effect's setFormData call).
        res = await getProjectProviderModels(projectId, existingId);
      } else {
        // Not yet saved (or rotating the key) — test raw credentials via
        // the same pre-save endpoint Studio's provider form uses; it only
        // proxies to the provider's API, it doesn't touch Project data.
        if (!formData.type) {
          toast.error("Please select a provider type first.");
          setLoadingModels(false);
          return;
        }
        const needsBaseUrl = formData.type === "custom";
        if (!formData.apiKey || (needsBaseUrl && !formData.baseURL)) {
          toast.error(
            needsBaseUrl
              ? "Please provide both Base URL and API Key to fetch models."
              : "Please provide an API Key to fetch models.",
          );
          setLoadingModels(false);
          return;
        }
        res = await testProviderCredentials(
          formData.type,
          needsBaseUrl ? formData.baseURL : undefined,
          formData.apiKey,
        );
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
      if (dataToSubmit.type !== "custom") {
        // Native types resolve to a canonical Base URL server-side.
        delete dataToSubmit.baseURL;
      }
      if (isEditing && !dataToSubmit.apiKey) delete dataToSubmit.apiKey;

      if (isEditing) {
        await updateProjectProvider(projectId, providerId, dataToSubmit);
        toast.success("Provider updated.");
      } else {
        await createProjectProvider(projectId, dataToSubmit);
        toast.success("Provider created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Provider.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>
              Pick a provider and add your API key — or choose Custom for any
              OpenAI-compatible endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="type">Provider</FieldLabel>
                <Select
                  value={formData.type}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      type: value,
                      baseURL: "",
                      defaultModel: "",
                    }));
                    setModels([]);
                  }}
                  required
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Choose OpenAI, Anthropic, Gemini, or DeepSeek for native
                  support, or Custom for any OpenAI-compatible endpoint.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="label">Label</FieldLabel>
                <Input
                  id="label"
                  name="label"
                  placeholder="e.g. Production OpenAI"
                  value={formData.label}
                  onChange={handleChange}
                  required
                  maxLength={100}
                />
                <FieldDescription>
                  A friendly name for this provider.
                </FieldDescription>
              </Field>

              {formData.type === "custom" && (
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
              )}

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
                    ? "Leave blank to keep the existing key."
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
                    onClick={() => fetchModels(isEditing ? providerId : null)}
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
                  <SelectTrigger id="defaultModel">
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
                  The model used by default for Agents attached to this
                  provider.
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
                    className="text-sm font-medium leading-none"
                  >
                    Set as default provider
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Used by default for this Project&apos;s new Agents.
                  </p>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              type="submit"
              disabled={saving}
              className="!bg-[#1E60FF] !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Provider" : "Create Provider"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
