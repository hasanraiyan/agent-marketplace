"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  getProjectStores,
  createProjectStore,
  updateProjectStore,
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

const sanitizeName = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");

export default function ProjectStoreEditorPage({ params: paramsPromise }) {
  const params = React.use(paramsPromise);
  const projectId = params.id;
  const storeId = params.storeId;
  const isEditing = storeId !== "new";
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: "domain",
    accessMode: "readwrite",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useDashboardHeader({
    title: isEditing ? "Edit Store" : "Add Store",
    description:
      "A named, scoped mount point Agents can be assigned to (see storeMounts on the Agent edit form).",
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
        const res = await getProjectStores(projectId);
        const stores = res.data?.data || [];
        const store = stores.find((s) => (s._id || s.id) === storeId);
        if (store) {
          setFormData({
            name: store.name || "",
            description: store.description || "",
            scope: store.scope || "domain",
            accessMode: store.accessMode || "readwrite",
          });
        } else {
          toast.error("Store not found");
          router.push(developerRoutes.project(projectId));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load Store.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, storeId, isEditing, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "name" ? sanitizeName(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        // scope is immutable after creation — never sent on update.
        const { name, description, accessMode } = formData;
        await updateProjectStore(projectId, storeId, {
          name,
          description,
          accessMode,
        });
        toast.success("Store updated.");
      } else {
        await createProjectStore(projectId, formData);
        toast.success("Store created.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Store.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Store Configuration</CardTitle>
            <CardDescription>
              Content is populated separately via the API — this form only
              manages the Store&apos;s config.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. product-notes"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={64}
                />
                <FieldDescription>
                  Lowercase letters, numbers, and hyphens only. Mounted at{" "}
                  <code>/stores/{formData.name || "&lt;name&gt;"}/</code> in
                  every Agent it&apos;s assigned to.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What does this Store hold, and why would an Agent read it?"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={1024}
                  rows={2}
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-sm font-bold">Scope</FieldLabel>
                  <Select
                    value={formData.scope}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, scope: v }))
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger className="h-11 bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain">
                        Domain — one shared copy for the whole Project
                      </SelectItem>
                      <SelectItem value="externalUser">
                        External user — one private copy per founder
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {isEditing
                      ? "Cannot be changed after creation."
                      : "Choose carefully — this cannot be changed after creation."}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel className="text-sm font-bold">
                    Access mode
                  </FieldLabel>
                  <Select
                    value={formData.accessMode}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, accessMode: v }))
                    }
                  >
                    <SelectTrigger className="h-11 bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="readwrite">
                        Read-write — Agents can also write to it
                      </SelectItem>
                      <SelectItem value="readonly">
                        Read-only — Agents can only read; edit content here
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Read-only stores are safe to assign to Agents serving many
                    different founders.
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Link href={developerRoutes.project(projectId)}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving} className="shadow-sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Store" : "Create Store"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
