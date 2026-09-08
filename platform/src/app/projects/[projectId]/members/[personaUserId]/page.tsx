"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ClockIcon,
  CopyIcon,
  FingerprintIcon,
  ShieldCheckIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProjectMembers, removeProjectMember } from "@/lib/api/projects";
import { getProfile } from "@/lib/api/profile";

interface Member {
  _id: string;
  personaUserId: string;
  role: string;
  name?: string | null;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function MemberDetailPage() {
  const { projectId, personaUserId } = useParams<{
    projectId: string;
    personaUserId: string;
  }>();
  const router = useRouter();
  const [member, setMember] = React.useState<Member | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isYou, setIsYou] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const membersHref = `/projects/${projectId}/members`;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectMembers(projectId)
      .then(async (res) => {
        if (cancelled) return;
        const list: Member[] = res.data?.data ?? res.data?.data?.items ?? [];
        const found = list.find((m) => m.personaUserId === personaUserId);
        if (!found) {
          setLoadError("Member not found.");
        } else {
          setMember(found);
        }
        // The "You" badge needs the signed-in developer's own Persona id.
        // A failure here just leaves the badge off — never fails the page.
        try {
          const profileRes = await getProfile();
          if (!cancelled && profileRes.data?.data?.id === personaUserId) {
            setIsYou(true);
          }
        } catch {
          setIsYou(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load member."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, personaUserId]);

  const handleRemove = async () => {
    if (!member) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeProjectMember(projectId, member.personaUserId);
      router.push(membersHref);
    } catch (err) {
      setRemoveError(errorMessage(err, "Failed to remove member."));
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full sm:w-96" />
        <Skeleton className="h-40 w-full sm:w-96" />
      </div>
    );
  }

  if (loadError || !member) {
    return (
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={membersHref} />}>Members</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Member not found</CardTitle>
            <CardDescription>{loadError ?? "This member does not exist in this project."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={membersHref} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back to members
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = member.name || member.email || member.personaUserId;
  const displayName = member.name
    ? member.name
    : member.email
      ? member.email.split("@")[0]
      : member.personaUserId;

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={membersHref} />}>Members</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[240px] truncate">{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/10 font-medium text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight">{displayName}</h1>
                {isYou && (
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    You
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">{member.role || "Admin"}</Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">{member.email || member.personaUserId}</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">{formatDate(member.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">{formatDate(member.updatedAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Access</span>
              <span className="font-medium capitalize">{member.role || "Admin"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid w-full items-start gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FingerprintIcon className="size-4 text-muted-foreground" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 divide-y divide-border text-xs">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <UsersThreeIcon className="size-3.5" />
                Persona User ID
              </span>
              <span className="flex items-center gap-1.5">
                <span className="max-w-[160px] truncate font-mono text-[11px] sm:max-w-[220px]">
                  {member.personaUserId}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Copy user ID"
                  onClick={async () => {
                    await navigator.clipboard.writeText(member.personaUserId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <CopyIcon data-icon="inline-start" className={copied ? "text-primary" : undefined} />
                </Button>
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ClockIcon className="size-3.5" />
                Created
              </span>
              <span className="font-mono text-[11px]">{formatDate(member.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple">
              <AccordionItem value="admin-access">
                <AccordionTrigger>What an Admin can do</AccordionTrigger>
                <AccordionContent>
                  <ul className="ml-1 flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
                    <li>Manage this Project&apos;s metadata and lifecycle.</li>
                    <li>Add or remove other Admins and send invitations.</li>
                    <li>Create, edit and delete Agents, Providers, Skills and other resources.</li>
                    <li>Mint and revoke machine credentials.</li>
                    <li>View the Project&apos;s audit trail.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="last-admin">
                <AccordionTrigger>Can they be removed?</AccordionTrigger>
                <AccordionContent>
                  <p>
                    Yes, as long as at least one other Admin remains. Every active
                    project must keep at least one Admin — removing the last one is
                    blocked.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <TrashIcon />
            Danger zone
          </CardTitle>
          <CardDescription>
            Revoke this member&apos;s Admin access to the project. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {removeError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {removeError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={membersHref} />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to members
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-fit bg-destructive text-white hover:bg-destructive/90 hover:text-white"
              disabled={isYou}
              onClick={() => setRemoveOpen(true)}
            >
              <TrashIcon data-icon="inline-start" />
              Remove member
            </Button>
          </div>
          {isYou && (
            <p className="text-xs text-muted-foreground">
              You can&apos;t remove yourself here — have another Admin do it, or
              leave from the Members list.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {displayName} will lose Admin access to this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {removeError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing && <Spinner />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}