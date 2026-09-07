"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  EnvelopeSimpleIcon,
  UserPlusIcon,
  UsersThreeIcon,
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
  revokeProjectInvitation,
  searchProjectMembers,
} from "@/lib/api/projects";

interface Member {
  _id: string;
  personaUserId: string;
  role: string;
  createdAt?: string;
}

interface Invitation {
  _id?: string;
  id?: string;
  email: string;
  role?: string;
  status: string;
  createdAt?: string;
}

interface SuggestionUser {
  id: string;
  name: string;
  email: string;
}

const EMPTY_ERROR_MESSAGE =
  "An unknown error occurred. Try again, or check that your session is still valid.";

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

export default function MembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);

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
  const [revokeInvitationTarget, setRevokeInvitationTarget] =
    React.useState<Invitation | null>(null);
  const [revokingInvitation, setRevokingInvitation] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);

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
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const memberPersonaIds = React.useMemo(
    () => new Set((members ?? []).map((m) => m.personaUserId)),
    [members]
  );

  const pendingInvitations = React.useMemo(
    () => invitations.filter((i) => i.status === "pending"),
    [invitations]
  );

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

  const handleRevokeInvitation = async () => {
    if (!revokeInvitationTarget) return;
    setRevokingInvitation(true);
    setRevokeError(null);
    try {
      const targetId =
        revokeInvitationTarget._id || revokeInvitationTarget.id;
      // Guard the possibly-undefined optional ids — a row from the list
      // always carries one, but TS can't see that.
      if (!targetId) return;
      await revokeProjectInvitation(projectId, targetId);
      setInvitations((prev) =>
        prev.filter((i) => (i._id || i.id) !== targetId)
      );
      setRevokeInvitationTarget(null);
    } catch (err) {
      setRevokeError(errorMessage(err, "Failed to revoke invitation."));
    } finally {
      setRevokingInvitation(false);
    }
  };

  const showNoAccountInvite =
    memberMode === "email" &&
    !memberSearching &&
    memberSuggestions.length === 0 &&
    memberQuery.trim().length >= 3 &&
    memberQuery.trim().toLowerCase() !== memberPickedEmail;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-y-auto p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersThreeIcon className="size-4 text-muted-foreground" />
              Members
            </CardTitle>
            <CardDescription>
              Admins who can manage this Project via their own Clerk session.
              Add by email (search as you type) or paste an internal Persona
              User id.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddMemberOpen(true)}>
            <UserPlusIcon />
            Add Admin
          </Button>
        </CardHeader>
        <CardContent>
          {members === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : members.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.personaUserId}>
                      <TableCell className="font-mono text-xs">
                        {m.personaUserId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoveMemberTarget(m)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
            Pending Invitations
          </CardTitle>
          <CardDescription>
            People invited by email who haven&apos;t created an account yet.
            Clerk emails them an accept link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
            </div>
          ) : pendingInvitations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((inv) => (
                    <TableRow key={inv._id || inv.id}>
                      <TableCell className="font-medium">
                        {inv.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.createdAt
                          ? new Date(inv.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevokeInvitationTarget(inv)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="border border-dashed border-border py-6">
              <EmptyHeader>
                <EmptyTitle>No pending invitations</EmptyTitle>
                <EmptyDescription>
                  Invited users will appear here until they accept.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                      const alreadyMember = memberPersonaIds.has(u.id);
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
              {removeMemberTarget?.personaUserId} will lose Admin access to
              this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError && (
            <p className="text-xs text-destructive">{removeError}</p>
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

      {/* Revoke invitation */}
      <AlertDialog
        open={!!revokeInvitationTarget}
        onOpenChange={(open) => !open && setRevokeInvitationTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeInvitationTarget?.email} will no longer be able to accept
              — the emailed link stops working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && (
            <p className="text-xs text-destructive">{revokeError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingInvitation}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeInvitation();
              }}
              disabled={revokingInvitation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokingInvitation && <Spinner />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
