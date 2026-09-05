"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { createProject } from "@/lib/api/projects";
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
  FieldDescription,
} from "@/components/ui/field";

export default function NewProjectPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slug: "",
  });
  const [saving, setSaving] = useState(false);

  useDashboardHeader({
    title: "New Project",
    description:
      "A Project is an external consumer of Persona's agent infrastructure — its own Admins, credentials, and owned resources.",
    actions: (
      <Link
        href={developerRoutes.projects}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Projects
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
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.slug) delete dataToSubmit.slug;
      if (!dataToSubmit.description) delete dataToSubmit.description;

      const res = await createProject(dataToSubmit);
      const project = res.data?.data;
      toast.success("Project created successfully");
      router.push(developerRoutes.project(project._id));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create Project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              You&apos;ll be granted an initial Admin membership automatically —
              every ACTIVE Project must always retain at least one Admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Beyond Campus"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  maxLength={100}
                />
                <FieldDescription>
                  A display name for this Project.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="beyond-campus"
                  value={formData.slug}
                  onChange={handleChange}
                  maxLength={100}
                />
                <FieldDescription>
                  Optional — display/routing convenience only, never used for
                  authorization.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What does this Project use Persona's agents for?"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={1000}
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.projects}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving} className="shadow-sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
