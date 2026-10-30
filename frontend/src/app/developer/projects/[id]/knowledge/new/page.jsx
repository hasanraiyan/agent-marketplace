"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { createProjectKnowledge } from "@/lib/api/projects";
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
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export default function NewProjectKnowledgePage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = { name: formData.name };
      if (formData.description) dataToSubmit.description = formData.description;

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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>New Knowledge Base</CardTitle>
            <CardDescription>
              Upload documents after creation from the Knowledge Base&apos;s
              own page. Embeddings use local Ollama (embeddinggemma-2).
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
                <FieldLabel htmlFor="description">
                  Description{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
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
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving} className="shadow-sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Knowledge Base
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
