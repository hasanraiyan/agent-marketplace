"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createProject } from "@/lib/api/projects";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProject({ name: name.trim() });
      const project = res.data?.data;
      router.push(`/projects/${project._id}`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create project.";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">New project</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="project-name">Name</FieldLabel>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
            autoFocus
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create project"}
        </Button>
      </form>
    </div>
  );
}
