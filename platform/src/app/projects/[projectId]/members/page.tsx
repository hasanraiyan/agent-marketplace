"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CaretRightIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  UserPlusIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  addProjectMember,
  getProjectInvitations,
  getProjectMembers,
  inviteProjectMember,
  removeProjectMember,
  searchProjectMembers,
} from "@/lib/api/projects";
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

interface Invitation {
  _id?: string;
  id?: string;
  email: string;
  role?: string;
  status: string;
  createdAt?: string;
  expiresAt?: string;
  invitedBy?: string;
  invitedByName?: string | null;
  invitedByEmail?: string | null;
}

interface SuggestionUser {
  id: string;
  name: string;
  email: string;
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

function displayName(m: Member): string {
  if (m.name) return m.name;
  if (m.email) return m.email.split("@")[0];
  return m.personaUserId;
}

function MemberAvatar({ name, size = "default" }: { name: string; size?: "default" | "sm" | "lg" }) {
  return (
    <Avatar size={size}>
      <AvatarFallback className="bg-primary/10 font-medium text-primary">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export default function MembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  // Add Admin dialog state.
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const [memberMode, setMemberMode] = React.useState<"email" | "id">("email");
  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberPickedEmail, setMemberPickedEmail] = React.useState<string | null>(null);
  const [memberSuggestions, setMemberSuggestions] = React.useState<SuggestionUser[]>([]);
  const [memberSearching, setMemberSearching] = React.useState(false);
  const [addingMember, setAddingMember] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [invitingEmail, setInvitingEmail] = React.useState<string>("");

  // Confirm-dialog targets.
  const [removeMemberTarget, setRemoveMemberTarget] = React.useState<Member | null>(null);
  const [removingMember, setRemovingMember] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const membersHref = `/projects/${projectId}/members`;
  const invitationsHref = `${membersHref}/invitations`;

  const load = React.useCallback(async () => {
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        getProjectMembers(projectId),
        getProjectInvitations(projectId),
      ]);
      setMembers(membersRes.data?.data || []);
      setInvitations(invitationsRes.data?.data || []);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Failed to load Members."));
      setMembers([]);
    }
    // The current user's own Persona id marks the "You" row. Failing to
    // load it (e.g. a stale session) must not break the member list.
    try {
      const profileRes = await getProfile();
      setCurrentUserId(profileRes.data?.data?.id ?? null);
    } catch {
      setCurrentUserId(null);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pendingInvitations = React.useMemo(
    () => invitations.filter((i) => i.status === "pending"),
    [invitations]
  );

  const filteredMembers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter((m) =>
      [m.name, m.email, m.personaUserId].some((v) => v?.toLowerCase().includes(q))
    );
  }, [members, search]);

  // Debounced email autocomplete for "Add Admin" — email mode only, 3+ char
  // prefix, and only when the query isn't exactly the account we already
  // picked (which would re-search after every keystroke past the pick).
  React.useEffect(() => {
    if (memberMode !== "email" || !addMemberOpen) {
      setMemberSuggestions([]);
      return;
    }
    const q = memberQuery.trim().toLowerCase();
    if (
      q.length < 3 ||
      (memberPickedEmail !== null && q === memberPickedEmail)
    ) {
      setMemberSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const res = await searchProjectMembers(projectId, q);
        if (!cancelled) setMemberSuggestions(res.data?.data ?? []);
      } catch {
        if (!cancelled) setMemberSuggestions([]);
      } finally {
        if (!cancelled) setMemberSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery, memberMode, addMemberOpen, memberPickedEmail, projectId]);

  const resetAddMemberDialog = () => {
    setMemberQuery("");
    setMemberSuggestions([]);
    setMemberPickedEmail(null);
    setAddError(null);
  };

  const closeAddMemberDialog = () => {
    setAddMemberOpen(false);
    resetAddMemberDialog();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = memberQuery.trim();
    if (!value) return;
    setAddingMember(true);
    setAddError(null);
    try {
      const payload =
        memberMode === "id" ? { personaUserId: value } : { email: value };
      const res = await addProjectMember(projectId, payload);
      setMembers((prev) => [...(prev ?? []), res.data?.data]);
      closeAddMemberDialog();
    } catch (err) {
      setAddError(errorMessage(err, "Failed to add Admin."));
    } finally {
      setAddingMember(false);
    }
  };

  const handleInviteMember = async (email: string) => {
    const value = email?.trim();
    if (!value) return;
    setInvitingEmail(value);
    setAddError(null);
    try {
      const res = await inviteProjectMember(projectId, value);
      setInvitations((prev) => [res.data?.data, ...prev].filter(Boolean));
      closeAddMemberDialog();
    } catch (err) {
      setAddError(errorMessage(err, "Failed to send invitation."));
    } finally {
      setInvitingEmail("");
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemovingMember(true);
    setRemoveError(null);
    try {
      await removeProjectMember(projectId, removeMemberTarget.personaUserId);
      const id = removeMemberTarget.personaUserId;
      setMembers((prev) => (prev ?? []).filter((m) => m.personaUserId !== id));
      setRemoveMemberTarget(null);
    } catch (err) {
      setRemoveError(errorMessage(err, "Failed to remove member."));
    } finally {
      setRemovingMember(false);
    }
  };

  const showNoAccountInvite =
    memberMode === "email" &&
    !memberSearching &&
    memberSuggestions.length === 0 &&
    memberQuery.trim().length >= 3 &&
    memberQuery.trim().toLowerCase() !== memberPickedEmail;

  const renderMemberRow = (m: Member) => {
    const isYou = currentUserId !== null && m.personaUserId === currentUserId;
    const detailHref = `${membersHref}/${m.personaUserId}`;
    const name = displayName(m);
    return (
      <React.Fragment key={m.personaUserId}>
        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(detailHref)}>
          <TableCell>
            <div className="flex items-center gap-3">
              <MemberAvatar name={name} />
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 truncate font-medium">
                  {name}
                  {isYou && (
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                      You
                    </Badge>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {m.email || m.personaUserId}
                </span>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="capitalize">{m.role || "Admin"}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">
            {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" render={<Link href={detailHref} />}>
                <EyeIcon data-icon="inline-start" />
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveMemberTarget(m)}
              >
                <TrashIcon data-icon="inline-start" />
                Remove
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  };

  const renderMemberAccordionItem = (m: Member) => {
    const isYou = currentUserId !== null && m.personaUserId === currentUserId;
    const detailHref = `${membersHref}/${m.personaUserId}`;
    const name = displayName(m);
    return (
      <AccordionItem key={m.personaUserId} value={m.personaUserId}>
        <AccordionTrigger className="gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <MemberAvatar name={name} size="sm" />
            <span className="flex min-w-0 flex-col items-start">
              <span className="flex items-center gap-1.5 truncate">
                {name}
                {isYou && (
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                    You
                  </Badge>
                )}
              </span>
              <span className="truncate text-[11px] font-normal text-muted-foreground">
                {m.email || m.personaUserId}
              </span>
            </span>
          </span>
          <Badge variant="outline" className="shrink-0 capitalize">{m.role || "Admin"}</Badge>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium">Persona User ID</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{m.personaUserId}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium">Joined</span>
              <span className="text-muted-foreground">
                {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Button size="sm" variant="outline" render={<Link href={detailHref} />}>
                <EyeIcon data-icon="inline-start" />
                View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveMemberTarget(m)}
              >
                <TrashIcon data-icon="inline-start" />
                Remove
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-base font-semibold sm:text-lg">Members</h1>
          <p className="line-clamp-3 max-w-xl text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs">
            Admins who can manage this Project via their own Clerk session.
            Add by email (search as you type) or paste an internal Persona User id.
          </p>
        </div>
        <Button size="sm" className="w-fit shrink-0" onClick={() => setAddMemberOpen(true)}>
          <UserPlusIcon data-icon="inline-start" />
          Add Admin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
          <span className="text-[11px] text-muted-foreground">Total members</span>
          <span className="text-2xl font-semibold tabular-nums">
            {members === null ? "—" : members.length}
          </span>
        </div>
        <Link
          href={invitationsHref}
          className="flex flex-col gap-1 border border-border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <span className="text-[11px] text-muted-foreground">Pending invitations</span>
          <span className="flex items-center gap-1 text-2xl font-semibold tabular-nums">
            {pendingInvitations.length}
            <CaretRightIcon className="size-4 text-muted-foreground" />
          </span>
        </Link>
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
          <span className="text-[11px] text-muted-foreground">Invitations sent</span>
          <span className="text-2xl font-semibold tabular-nums">{invitations.length}</span>
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersThreeIcon className="size-4 text-muted-foreground" />
              Members
            </CardTitle>
            <CardDescription>
              Every member holds Admin access. Open a member to see their details.
            </CardDescription>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or ID…"
              className="pl-9 sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {members === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : filteredMembers.length === 0 ? (
            search ? (
              <Empty className="border border-dashed border-border py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MagnifyingGlassIcon />
                  </EmptyMedia>
                  <EmptyTitle>No members match “{search.trim()}”</EmptyTitle>
                  <EmptyDescription>Try a different name, email or user id.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="border border-dashed border-border py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersThreeIcon />
                  </EmptyMedia>
                  <EmptyTitle>No members yet</EmptyTitle>
                  <EmptyDescription>
                    Invite an admin to collaborate on this project.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filteredMembers.map(renderMemberRow)}</TableBody>
                </Table>
              </div>
              {/* Mobile accordion */}
              <Accordion multiple className="sm:hidden">
                {filteredMembers.map(renderMemberAccordionItem)}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations summary */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              People invited by email who haven&apos;t created an account yet.
              Clerk emails them an accept link.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="w-fit shrink-0" render={<Link href={invitationsHref} />}>
            Manage invitations
            <CaretRightIcon data-icon="inline-end" />
          </Button>
        </CardHeader>
        <CardContent>
          {members === null ? (
            <Skeleton className="h-8 w-full" />
          ) : pendingInvitations.length > 0 ? (
            <div className="flex flex-col divide-y divide-border">
              {pendingInvitations.map((inv) => (
                <div key={inv._id || inv.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{inv.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {inv.createdAt
                        ? `Invited ${new Date(inv.createdAt).toLocaleDateString()}`
                        : "Invited recently"}
                    </span>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/10 text-primary text-[10px]">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pending invitations. Invite someone without a Persona account from the
              Add Admin dialog or the Invitations page.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Admin */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>Add Admin</DialogTitle>
              <DialogDescription>
                Grants Admin membership to an existing Persona User. Search by
                email, or switch to paste an internal User id.
              </DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor="new-member-id">
                {memberMode === "email" ? "Email" : "Persona User ID"}
              </FieldLabel>
              <div className="relative">
                <Input
                  id="new-member-id"
                  value={memberQuery}
                  onChange={(e) => {
                    setMemberQuery(e.target.value);
                    setMemberPickedEmail(null);
                  }}
                  placeholder={
                    memberMode === "email"
                      ? "e.g. dev@example.com"
                      : "e.g. 64f1c2…"
                  }
                  type={memberMode === "email" ? "email" : "text"}
                  autoFocus
                  required
                />
                {memberMode === "email" && showNoAccountInvite && (
                  <div className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      No Persona account found for this email — you can invite
                      them instead.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="self-start"
                      disabled={!!invitingEmail}
                      onClick={() => handleInviteMember(memberQuery)}
                    >
                      {invitingEmail ? <Spinner /> : <EnvelopeSimpleIcon />}
                      Invite by email
                    </Button>
                  </div>
                )}
                {memberMode === "email" && memberSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                    {memberSuggestions.map((u) => {
                      const alreadyMember = (members ?? []).some(
                        (m) => m.personaUserId === u.id
                      );
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={alreadyMember}
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs transition-colors ${
                            alreadyMember
                              ? "cursor-not-allowed opacity-50"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => {
                            if (alreadyMember) return;
                            setMemberQuery(u.email);
                            setMemberPickedEmail(u.email.toLowerCase());
                            setMemberSuggestions([]);
                          }}
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-muted-foreground">
                            {u.email}
                            {alreadyMember && " · Already a member"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {memberMode === "email" && memberSearching && (
                  <Spinner className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              <FieldDescription>
                {memberMode === "email"
                  ? "Start typing an email — matching Persona users appear below."
                  : "Paste the internal Persona User id (shown in the Members table)."}
              </FieldDescription>
            </Field>
            {addError && <FieldError>{addError}</FieldError>}
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                setMemberMode((m) => (m === "email" ? "id" : "email"));
                setMemberQuery("");
                setMemberSuggestions([]);
                setMemberPickedEmail(null);
              }}
            >
              {memberMode === "email"
                ? "Add by internal User id instead"
                : "Add by email instead"}
            </button>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeAddMemberDialog}
                disabled={addingMember || !!invitingEmail}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingMember || !memberQuery.trim()}>
                {addingMember && <Spinner />}
                Add Admin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member */}
      <AlertDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMemberTarget?.name || removeMemberTarget?.email || removeMemberTarget?.personaUserId}{" "}
              will lose Admin access to this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {removeError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRemoveMember();
              }}
              disabled={removingMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingMember && <Spinner />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}