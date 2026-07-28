"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  Calendar,
  Shield,
  BadgeCheck,
  Loader2,
  BrainIcon,
  SettingsIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useUser, useAuth } from "@clerk/nextjs";
import { getProfile, updateProfile } from "@/lib/api/profile";
import { countAgents } from "@/lib/api/agents";
import { getThreads } from "@/lib/api/threads";
import { getProviders } from "@/lib/api/providers";
import { useDashboardHeader } from "@/components/dashboard-header-context";

export default function ProfileSettingsPage() {
  const { user: clerkUser } = useUser();
  const { isLoaded, isSignedIn } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    age: "",
  });

  const [stats, setStats] = useState({
    agents: null,
    threads: null,
    providers: null,
  });

  useDashboardHeader({
    title: "Profile",
    description: "Manage your account information and preferences.",
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const load = async () => {
      try {
        const res = await getProfile();
        const p = res.data?.data || res.data;
        setProfile(p);
        setForm({
          name: p?.name || "",
          age: p?.age ?? "",
        });
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!profile) return;
    const loadStats = async () => {
      try {
        const ownerId = profile.id || profile._id;
        const [agentCount, threadsRes, providersRes] = await Promise.all([
          countAgents({ ownerId }).catch(() => null),
          getThreads().catch(() => null),
          getProviders().catch(() => null),
        ]);
        setStats({
          agents: agentCount?.data?.data?.total ?? 0,
          threads: threadsRes?.data?.data?.total ?? (threadsRes?.data?.data?.length ?? 0),
          providers: providersRes?.data?.data?.length ?? 0,
        });
      } catch {
        // ignore stats failures
      }
    };
    loadStats();
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    const payload = {};
    if (trimmedName !== profile?.name) payload.name = trimmedName;
    if (form.age !== "" && Number(form.age) !== profile?.age) {
      payload.age = Number(form.age);
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      // Sync with Clerk if name changed
      if (payload.name && clerkUser) {
        const parts = payload.name.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        await clerkUser.update({ firstName, lastName });
      }

      const res = await updateProfile(payload);
      setProfile(res.data?.data || res.data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const displayName = profile?.name || clerkUser?.fullName || "Guest User";
  const email =
    profile?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
  const initials =
    (displayName || email || "U")
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center">
          <Avatar className="size-20">
            <AvatarImage src={clerkUser?.imageUrl} alt={displayName} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{displayName}</h2>
              {profile?.emailVerified && (
                <Badge variant="outline">
                  <BadgeCheck className="size-4 mr-1" />
                  Verified
                </Badge>
              )}
              {profile?.role && profile.role !== "user" && (
                <Badge variant="secondary" className="capitalize">
                  <Shield className="size-4 mr-1" />
                  {profile.role}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            {profile?.createdAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Member since {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your display name and age.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      maxLength={100}
                      required
                    />
                    <FieldDescription>
                      Between 2 and 100 characters.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" value={email} disabled />
                    <FieldDescription>
                      Email is managed by your identity provider.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="age">Age</FieldLabel>
                    <Input
                      id="age"
                      type="number"
                      min={0}
                      max={150}
                      value={form.age}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, age: e.target.value }))
                      }
                    />
                    <FieldDescription>Optional.</FieldDescription>
                  </Field>

                  <div className="pt-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>
                Read-only information about your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email</span>
                  </div>
                  <span className="truncate font-medium">{email}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Role</span>
                  </div>
                  <span className="font-medium capitalize">
                    {profile?.role || "user"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Email Verified
                    </span>
                  </div>
                  <span className="font-medium">
                    {profile?.emailVerified ? "Yes" : "No"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Joined</span>
                  </div>
                  <span className="font-medium">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainIcon className="size-5 text-indigo-500" />
                AI Memory & Personalization
              </CardTitle>
              <CardDescription>
                Agents now remember you through markdown memory files they read and update during
                conversations — shared user memory plus per-agent memory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  View, edit, and delete everything your agents remember from the Memory Dashboard.
                </p>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/studio/memory">
                    <Sparkles className="size-4 mr-1.5 text-indigo-500" />
                    Open Memory Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Activity</CardTitle>
              <CardDescription>
                A quick snapshot of your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Link
                  href="/dashboard/agents"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <BrainIcon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">My Agents</span>
                  </div>
                  {stats.agents === null ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <Badge variant="secondary">{stats.agents}</Badge>
                  )}
                </Link>

                <Link
                  href="/studio/providers"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <SettingsIcon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Providers</span>
                  </div>
                  {stats.providers === null ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <Badge variant="secondary">{stats.providers}</Badge>
                  )}
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>
                Manage your sign-in credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Password, two-factor, and connected accounts are managed in
                your Clerk identity settings.
              </p>
              <Link
                href="https://accounts.clerk.com/user"
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="mt-4 w-full">
                  Manage Identity
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
