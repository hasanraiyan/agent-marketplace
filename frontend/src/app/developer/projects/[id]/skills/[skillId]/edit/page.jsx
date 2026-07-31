"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  getProjectSkills,
  createProjectSkill,
  updateProjectSkill,
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
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

const sanitizeName = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");

export default function ProjectSkillEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const skillId = params.skillId;
  const isEditing = skillId !== "new";
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
    isPublic: false,
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit Skill" : "Add Skill",
    description: "Author a Skill this Project's Agents can use.",
  });

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const res = await getProjectSkills(projectId);
        const skills = res.data?.data || [];
        const skill = skills.find((s) => (s._id || s.id) === skillId);
        if (skill) {
          setFormData({
            name: skill.name || "",
            description: skill.description || "",
            instructions: skill.instructions || "",
            isPublic: skill.isPublic || false,
          });
          setFiles(
            (skill.files || []).map((f) => ({
              path: f.path || "",
              content: f.content || "",
            })),
          );
        } else {
          toast.error("Skill not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Skill.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, skillId, isEditing, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "name" ? sanitizeName(value) : value,
    }));
  };

  const addFile = () => {
    setFiles((prev) => [...prev, { path: "", content: "" }]);
  };

  const updateFile = (index, field, value) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    );
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSubmit = { ...formData };
      const cleanFiles = files.filter((f) => f.path.trim());
      if (cleanFiles.length > 0) dataToSubmit.files = cleanFiles;

      if (isEditing) {
        await updateProjectSkill(projectId, skillId, dataToSubmit);
        toast.success("Skill updated.");
      } else {
        await createProjectSkill(projectId, dataToSubmit);
        toast.success("Skill created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Skill.");
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
            <Skeleton className="h-32 w-full" />
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
          {isEditing ? "Edit Skill" : "New Skill"}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Skill Configuration</CardTitle>
            <CardDescription>
              The SKILL.md instructions and any supporting files this
              Project&apos;s Agents can attach.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. customer-support-tone"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={64}
                />
                <FieldDescription>
                  Lowercase letters, numbers, and hyphens only.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What does this Skill teach an Agent to do?"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  minLength={10}
                  maxLength={1024}
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="instructions">
                  Instructions (SKILL.md)
                </FieldLabel>
                <Textarea
                  id="instructions"
                  name="instructions"
                  placeholder="Write the full instructions an Agent should follow when using this Skill..."
                  value={formData.instructions}
                  onChange={handleChange}
                  required
                  minLength={10}
                  rows={12}
                  className="font-mono text-sm"
                />
                <FieldDescription>
                  The full content of this Skill&apos;s SKILL.md.
                </FieldDescription>
              </Field>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Public</p>
                  <p className="text-sm text-muted-foreground">
                    Visible to other Domains browsing the marketplace.
                  </p>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isPublic: checked }))
                  }
                />
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <FieldLabel>Supporting files</FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFile}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add file
                  </Button>
                </div>
                <FieldDescription>
                  Optional reference files bundled alongside SKILL.md (e.g.
                  references/style-guide.md).
                </FieldDescription>
                {files.map((file, index) => (
                  <div key={index} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="references/style-guide.md"
                        value={file.path}
                        onChange={(e) =>
                          updateFile(index, "path", e.target.value)
                        }
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="File content..."
                      value={file.content}
                      onChange={(e) =>
                        updateFile(index, "content", e.target.value)
                      }
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Skill" : "Create Skill"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
