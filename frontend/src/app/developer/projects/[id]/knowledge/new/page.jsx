"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  createProjectKnowledge,
  getProjectProviders,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";

export default function NewProjectKnowledgePage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const router = useRouter();

  const [providers, setProviders] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    providerId: "",
    embeddingModel: "text-embedding-3-small",
    chunkSize: "",
    chunkOverlap: "",
    topK: "",
  });
  const [saving, setSaving] = useState(false);

  useDashboardHeader({
    title: "New Knowledge Base",
    description: "Configure a Knowledge Base this Project's Agents can search.",
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
    (async () => {
      try {
        const res = await getProjectProviders(projectId);
        const list = res.data?.data || [];
        setProviders(list);
        const defaultProvider = list.find((p) => p.isDefault) || list[0];
        if (defaultProvider) {
          setFormData((prev) => ({ ...prev, providerId: defaultProvider.id }));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Providers.");
      }
    })();
  }, [projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.providerId) {
      toast.error("Add a Provider first — a Knowledge Base needs one.");
      return;
    }
    setSaving(true);
    try {
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.description) delete dataToSubmit.description;
      if (!dataToSubmit.chunkSize) delete dataToSubmit.chunkSize;
      else dataToSubmit.chunkSize = Number(dataToSubmit.chunkSize);
      if (!dataToSubmit.chunkOverlap) delete dataToSubmit.chunkOverlap;
      else dataToSubmit.chunkOverlap = Number(dataToSubmit.chunkOverlap);
      if (!dataToSubmit.topK) delete dataToSubmit.topK;
      else dataToSubmit.topK = Number(dataToSubmit.topK);

      const res = await createProjectKnowledge(projectId, dataToSubmit);
      const kb = res.data?.data;
      toast.success("Knowledge Base created.");
      router.push(
        developerRoutes.projectKnowledgeDetail(projectId, kb._id || kb.id),
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to create Knowledge Base.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Knowledge Base Configuration</CardTitle>
            <CardDescription>
              Documents are uploaded after creation, from the Knowledge
              Base&apos;s own page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Product Docs"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  maxLength={200}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What does this Knowledge Base contain?"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={1000}
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="providerId">Provider</FieldLabel>
                <NativeSelect
                  id="providerId"
                  name="providerId"
                  value={formData.providerId}
                  onChange={handleChange}
                  required
                  className="w-full"
                >
                  <NativeSelectOption value="" disabled>
                    {providers.length > 0
                      ? "Select a Provider"
                      : "No Providers yet — add one first"}
                  </NativeSelectOption>
                  {providers.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.label}
                      {p.isDefault ? " (Default)" : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Used to generate embeddings for uploaded documents.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="embeddingModel">
                  Embedding Model
                </FieldLabel>
                <NativeSelect
                  id="embeddingModel"
                  name="embeddingModel"
                  value={formData.embeddingModel}
                  onChange={handleChange}
                  className="w-full"
                >
                  <NativeSelectOption value="text-embedding-3-small">
                    text-embedding-3-small (1536 dim — Recommended)
                  </NativeSelectOption>
                  <NativeSelectOption value="text-embedding-3-large">
                    text-embedding-3-large (3072 dim)
                  </NativeSelectOption>
                  <NativeSelectOption value="text-embedding-ada-002">
                    text-embedding-ada-002 (1536 dim)
                  </NativeSelectOption>
                </NativeSelect>
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="chunkSize">Chunk Size</FieldLabel>
                  <Input
                    id="chunkSize"
                    name="chunkSize"
                    type="number"
                    min={1}
                    placeholder="1000"
                    value={formData.chunkSize}
                    onChange={handleChange}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="chunkOverlap">Chunk Overlap</FieldLabel>
                  <Input
                    id="chunkOverlap"
                    name="chunkOverlap"
                    type="number"
                    min={0}
                    placeholder="200"
                    value={formData.chunkOverlap}
                    onChange={handleChange}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="topK">Top K</FieldLabel>
                  <Input
                    id="topK"
                    name="topK"
                    type="number"
                    min={1}
                    placeholder="5"
                    value={formData.topK}
                    onChange={handleChange}
                  />
                </Field>
              </div>
              <FieldDescription>
                Leave the advanced settings blank to use their defaults.
              </FieldDescription>
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
              Create Knowledge Base
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
