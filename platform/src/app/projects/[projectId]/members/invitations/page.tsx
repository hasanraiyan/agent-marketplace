"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  EnvelopeSimpleIcon,
  PaperPlaneTiltIcon,
  TrashIcon,
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
  getProjectInvitations,
  inviteProjectMember,
  revokeProjectInvitation,
} from "@/lib/api/projects";

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

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
        Pending
      </Badge>
    );
  }
  if (status === "accepted") {
    return <Badge variant="outline">Accepted</Badge>;
  }
  if (status === "revoked") {
    return <Badge variant="destructive">Revoked</Badge>;
  }
  return <Badge variant="secondary">Expired</Badge>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function InvitationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [invitations, setInvitations] = React.useState<Invitation[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  // Invite dialog state.
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [sendingInvite, setSendingInvite] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  // Revoke confirm state.
  const [revokeTarget, setRevokeTarget] = React.useState<Invitation | null>(null);
  const [revoking, setRevoking] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);

  const membersHref = `/projects/${projectId}/members`;

  const load = React.useCallback(async () => {
    try {
      const res = await getProjectInvitations(projectId);
      setInvitations(res.data?.data || []);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Failed to load invitations."));
      setInvitations([]);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredInvitations = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitations ?? [];
    return (invitations ?? []).filter((inv) =>
      [inv.email, inv.invitedByName, inv.invitedByEmail].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [invitations, search]);

  const pendingCount = React.useMemo(
    () => (invitations ?? []).filter((i) => i.status === "pending").length,
    [invitations]
  );
  const acceptedCount = React.useMemo(
    () => (invitations ?? []).filter((i) => i.status === "accepted").length,
    [invitations]
  );

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteError(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = inviteEmail.trim();
    if (!value) return;
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await inviteProjectMember(projectId, value);
      setInvitations((prev) => [res.data?.data, ...(prev ?? [])].filter(Boolean));
      closeInviteDialog();
    } catch (err) {
      setInviteError(errorMessage(err, "Failed to send invitation."));
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const targetId = revokeTarget._id || revokeTarget.id;
    if (!targetId) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await revokeProjectInvitation(projectId, targetId);
      const updated = res.data?.data;
      setInvitations((prev) =>
        (prev ?? []).map((i) =>
          (i._id || i.id) === targetId ? (updated ?? { ...i, status: "revoked" }) : i
        )
      );
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(errorMessage(err, "Failed to revoke invitation."));
    } finally {
      setRevoking(false);
    }
  };

  const renderRow = (inv: Invitation) => {
    const targetId = inv._id || inv.id;
    const isPending = inv.status === "pending";
    return (
      <TableRow key={targetId || inv.email}>
        <TableCell>
          <span className="max-w-[220px] truncate font-medium">{inv.email}</span>
        </TableCell>
        <TableCell>
          <StatusBadge status={inv.status} />
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="capitalize">{inv.role || "Admin"}</Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
        <TableCell className="text-muted-foreground">{formatDate(inv.expiresAt)}</TableCell>
        <TableCell>
          <span className="flex flex-col">
            <span className="max-w-[160px] truncate text-xs font-medium">
              {inv.invitedByName || (inv.invitedBy ? "A project admin" : "—")}
            </span>
            {inv.invitedByEmail && (
              <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                {inv.invitedByEmail}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="text-right">
          {isPending ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setRevokeTarget(inv)}
            >
              <TrashIcon data-icon="inline-start" />
              Revoke
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderAccordionItem = (inv: Invitation) => {
    const targetId = inv._id || inv.id;
    const isPending = inv.status === "pending";
    return (
      <AccordionItem key={targetId || inv.email} value={targetId || inv.email}>
        <AccordionTrigger className="gap-3">
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="truncate">{inv.email}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {formatDate(inv.createdAt)}
            </span>
          </span>
          <StatusBadge status={inv.status} />
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium">Role</span>
              <span className="capitalize text-muted-foreground">{inv.role || "Admin"}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium">Expires</span>
              <span className="text-muted-foreground">{formatDate(inv.expiresAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium">Invited by</span>
              <span className="text-muted-foreground">
                {inv.invitedByName || (inv.invitedBy ? "A project admin" : "—")}
              </span>
            </div>
            {isPending && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1 w-fit text-destructive hover:text-destructive"
                onClick={() => setRevokeTarget(inv)}
              >
                <TrashIcon data-icon="inline-start" />
                Revoke
              </Button>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Button variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground" render={<Link href={membersHref} />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Members
          </Button>
          <h1 className="truncate text-base font-semibold sm:text-lg">Invitations</h1>
          <p className="line-clamp-3 max-w-xl text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs">
            People invited by email who don&apos;t have a Persona account yet.
            Clerk emails them an accept link — pending invitations can be revoked at any time.
          </p>
        </div>
        <Button size="sm" className="w-fit shrink-0" onClick={() => setInviteOpen(true)}>
          <EnvelopeSimpleIcon data-icon="inline-start" />
          Invite member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
          <span className="text-[11px] text-muted-foreground">Pending</span>
          <span className="text-2xl font-semibold tabular-nums">
            {invitations === null ? "—" : pendingCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
          <span className="text-[11px] text-muted-foreground">Accepted</span>
          <span className="text-2xl font-semibold tabular-nums">
            {invitations === null ? "—" : acceptedCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
          <span className="text-[11px] text-muted-foreground">Total sent</span>
          <span className="text-2xl font-semibold tabular-nums">
            {invitations === null ? "—" : invitations.length}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PaperPlaneTiltIcon className="size-4 text-muted-foreground" />
              All invitations
            </CardTitle>
            <CardDescription>
              Pending, accepted, revoked and expired invitations for this project.
            </CardDescription>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="sm:w-64"
          />
        </CardHeader>
        <CardContent>
          {invitations === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : filteredInvitations.length === 0 ? (
            <Empty className="border border-dashed border-border py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <EnvelopeSimpleIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {search ? "No invitations match your search" : "No invitations yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Try a different email address."
                    : "Invite someone by email and they'll appear here until they accept."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Invited by</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filteredInvitations.map(renderRow)}</TableBody>
                </Table>
              </div>
              {/* Mobile accordion */}
              <Accordion type="multiple" className="sm:hidden">
                {filteredInvitations.map(renderAccordionItem)}
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite member */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>
                Send an invitation email to someone without a Persona account yet.
                They&apos;ll get Admin access once they accept.
              </DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. teammate@example.com"
                autoFocus
                required
              />
              <FieldDescription>
                The invitation link expires after 7 days. Already have a Persona
                account? Add them as an Admin from the Members page instead.
              </FieldDescription>
            </Field>
            {inviteError && <FieldError>{inviteError}</FieldError>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeInviteDialog} disabled={sendingInvite}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingInvite || !inviteEmail.trim()}>
                {sendingInvite ? <Spinner /> : <EnvelopeSimpleIcon />}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke invitation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.email} will no longer be able to accept — the
              emailed link stops working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {revokeError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Spinner />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}