"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CpuIcon, InfoIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createProjectProvider, testProviderCredentials } from "@/lib/api/projects";

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "Custom" },
];

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function NewProviderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    type: "",
    label: "",
    baseURL: "",
    apiKey: "",
    defaultModel: "",
    isDefault: false,
  });
  const [models, setModels] = React.useState<{ id: string; label?: string }[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement & { checked: boolean };
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    setError(null);
    try {
      if (!formData.type) {
        setError("Please select a provider type first.");
        return;
      }
      const needsBaseUrl = formData.type === "custom";
      if (!formData.apiKey || (needsBaseUrl && !formData.baseURL)) {
        setError(needsBaseUrl ? "Please provide both Base URL and API Key to fetch models." : "Please provide an API Key to fetch models.");
        return;
      }
      const res = await testProviderCredentials(formData.type, needsBaseUrl ? formData.baseURL : undefined, formData.apiKey);
      const fetched = res.data?.data?.models || res.data?.data || [];
      setModels(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch models. Check your credentials."));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = { ...formData };
      if (data.type !== "custom") delete data.baseURL;
      await createProjectProvider(projectId, data);
      router.push(`/projects/${projectId}/providers`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save provider."));
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/projects/${projectId}/providers`} />}>Providers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New provider</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <CpuIcon />
          </span>
          New provider
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Configure an AI provider this Project owns — OpenAI, Anthropic, Gemini, DeepSeek or any OpenAI-compatible endpoint.</p>
      </div>

      <Separator />

      <div className="grid w-full items-start gap-6 lg:grid-cols-[1.65fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>Pick a provider and add your API key — or choose Custom for any OpenAI-compatible endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="type">Provider</FieldLabel>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, type: value, baseURL: "", defaultModel: "" }));
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
                  <FieldDescription>Choose OpenAI, Anthropic, Gemini, or DeepSeek for native support, or Custom for any OpenAI-compatible endpoint.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="label">Label</FieldLabel>
                  <Input id="label" name="label" placeholder="e.g. Production OpenAI" value={formData.label} onChange={handleChange} required maxLength={100} />
                  <FieldDescription>A friendly name for this provider.</FieldDescription>
                </Field>

                {formData.type === "custom" && (
                  <Field>
                    <FieldLabel htmlFor="baseURL">Base URL</FieldLabel>
                    <Input id="baseURL" name="baseURL" type="url" placeholder="https://api.openai.com/v1" value={formData.baseURL} onChange={handleChange} required />
                    <FieldDescription>The API endpoint for the provider.</FieldDescription>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
                  <Input id="apiKey" name="apiKey" type="password" placeholder="sk-..." value={formData.apiKey} onChange={handleChange} required />
                  <FieldDescription>Your secret API key. Stored encrypted (AES-256-GCM) and never returned.</FieldDescription>
                </Field>

                <Field>
                  <div className="mb-2 flex items-center justify-between">
                    <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
                    <Button type="button" variant="outline" size="sm" onClick={fetchModels} disabled={loadingModels}>
                      {loadingModels ? "Fetching…" : "Fetch Models"}
                    </Button>
                  </div>
                  <Select
                    value={formData.defaultModel}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, defaultModel: value }))}
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
                        <SelectItem value="__none" disabled>
                          {formData.defaultModel || "No models fetched yet"}
                        </SelectItem>
                      )}
                      {models.length === 0 && formData.defaultModel && (
                        <SelectItem value={formData.defaultModel}>{formData.defaultModel}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FieldDescription>The model used by default for Agents attached to this provider.</FieldDescription>
                </Field>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isDefault: !!checked }))}
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="isDefault" className="text-sm font-medium leading-none">
                      Set as default provider
                    </label>
                    <p className="text-xs text-muted-foreground">Used by default for this Project&apos;s new Agents.</p>
                  </div>
                </div>
              </FieldGroup>

              {error && <FieldError>{error}</FieldError>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" render={<Link href={`/projects/${projectId}/providers`} />}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}/providers`)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create provider"}
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
                How providers work
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
              <p>Providers are Project-scoped LLM credentials. Agents pick a provider via <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">providerId</code>.</p>
              <p>API keys are encrypted at rest and never returned by the list endpoint. Rotate by editing and entering a new key.</p>
              <Separator />
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                <li>Native types fill the canonical Base URL automatically.</li>
                <li>Custom requires your own URL.</li>
                <li>Default provider is used when an Agent doesn&apos;t specify one.</li>
              </ul>
            </CardContent>
          </Card>
          <Alert>
            <InfoIcon />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>Click Fetch Models after entering your API key to see available models for your account.</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
