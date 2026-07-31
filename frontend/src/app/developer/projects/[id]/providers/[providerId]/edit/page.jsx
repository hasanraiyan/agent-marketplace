"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  getProjectProviders,
  createProjectProvider,
  updateProjectProvider,
} from "@/lib/api/projects";
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
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectProviderEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const providerId = params.providerId;
  const isEditing = providerId !== "new";
  const router = useRouter();

  const [formData, setFormData] = useState({
    label: "",
    baseURL: "",
    apiKey: "",
    defaultModel: "",
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit Provider" : "Add Provider",
    description: "Configure an AI provider this Project owns.",
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
            label: provider.label || "",
            baseURL: provider.baseURL || "",
            apiKey: "",
            defaultModel: provider.defaultModel || "",
            isDefault: provider.isDefault || false,
          });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = { ...formData };
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
      <div className="flex items-center gap-4">
        <Link href={developerRoutes.project(projectId)}>
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
              Connection details for this Project&apos;s OpenAI-compatible AI
              provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
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
                    ? "Leave blank to keep the existing key."
                    : "Your secret API key."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
                <Input
                  id="defaultModel"
                  name="defaultModel"
                  placeholder="e.g. gpt-4o"
                  value={formData.defaultModel}
                  onChange={handleChange}
                  required
                />
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
