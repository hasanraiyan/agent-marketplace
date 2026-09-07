"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { KeyIcon, WarningIcon } from "@phosphor-icons/react";
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
import { CopyButton } from "@/components/projects/copy-button";
import {
  getProjectCredentials,
  mintProjectCredential,
  revokeProjectCredential,
} from "@/lib/api/projects";

interface Credential {
  _id?: string;
  id?: string;
  keyId: string;
  label?: string;
  status: string;
  lastUsedAt?: string | null;
}

interface MintedSecret {
  keyId: string;
  secret: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

function credentialBadgeClass(c: Credential) {
  // ACTIVE gets the same emerald treatment as the old Studio; everything
  // else (REVOKED is the only other status) falls back to the "secondary"
  // variant, which is applied via className below.
  return c.status === "ACTIVE"
    ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : "bg-secondary text-secondary-foreground border-transparent";
}

export default function CredentialsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [credentials, setCredentials] = React.useState<Credential[] | null>(
    null
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [mintOpen, setMintOpen] = React.useState(false);
  const [mintLabel, setMintLabel] = React.useState("");
  const [minting, setMinting] = React.useState(false);
  const [mintError, setMintError] = React.useState<string | null>(null);

  const [mintedSecret, setMintedSecret] = React.useState<MintedSecret | null>(
    null
  );

  const [revokeTarget, setRevokeTarget] = React.useState<Credential | null>(
    null
  );
  const [revoking, setRevoking] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getProjectCredentials(projectId)
      .then((res) => {
        if (!cancelled) setCredentials(res.data?.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(errorMessage(err, "Failed to load Credentials."));
          setCredentials([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const closeMintDialog = () => {
    setMintOpen(false);
    setMintLabel("");
    setMintError(null);
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setMinting(true);
    setMintError(null);
    try {
      const label = mintLabel.trim();
      const res = await mintProjectCredential(projectId, label || undefined);
      const created = res.data?.data;
      setMintedSecret({ keyId: created?.keyId, secret: created?.secret });
      // The plaintext secret must not linger in list state — it only exists
      // in the one-time reveal dialog.
      const { secret: _secret, ...credential } = created ?? {};
      setCredentials((prev) => [credential, ...(prev ?? [])]);
      closeMintDialog();
    } catch (err) {
      setMintError(errorMessage(err, "Failed to mint credential."));
    } finally {
      setMinting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const credentialId = revokeTarget._id || revokeTarget.id;
      // Guard the possibly-undefined optional ids — a row from the list
      // always carries one, but TS can't see that.
      if (!credentialId) return;
      const res = await revokeProjectCredential(projectId, credentialId);
      // The service returns the updated (now REVOKED) row.
      setCredentials((prev) =>
        (prev ?? []).map((c) =>
          (c._id || c.id) === credentialId ? res.data?.data ?? c : c
        )
      );
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(errorMessage(err, "Failed to revoke credential."));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-y-auto p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="size-4 text-muted-foreground" />
              Credentials
            </CardTitle>
            <CardDescription>
              API credentials this Project&apos;s SDK uses to authenticate —
              separate from your own Clerk session used here in Studio.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setMintOpen(true)}>
            <KeyIcon />
            Mint new
          </Button>
        </CardHeader>
        <CardContent>
          {credentials === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : loadError ? (
            <p className="text-xs text-destructive">{loadError}</p>
          ) : credentials.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Key ID</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((c) => (
                    <TableRow key={c._id || c.id || c.keyId}>
                      <TableCell>
                        <CopyButton
                          value={c.keyId}
                          label="Key ID"
                          className="font-mono"
                        />
                      </TableCell>
                      <TableCell>{c.label || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "ACTIVE" ? "outline" : "secondary"}
                          className={credentialBadgeClass(c)}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.lastUsedAt
                          ? new Date(c.lastUsedAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevokeTarget(c)}
                          >
                            Revoke
                          </Button>
                        )}
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
                  <KeyIcon />
                </EmptyMedia>
                <EmptyTitle>No credentials yet</EmptyTitle>
                <EmptyDescription>
                  Mint a credential for this Project&apos;s SDK to authenticate
                  with.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {/* Mint new credential */}
      <Dialog open={mintOpen} onOpenChange={(open) => !open && closeMintDialog()}>
        <DialogContent>
          <form onSubmit={handleMint}>
            <DialogHeader>
              <DialogTitle>Mint new credential</DialogTitle>
              <DialogDescription>
                The secret is shown exactly once right after this — copy it
                immediately, it can never be retrieved again.
              </DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor="mint-label">Label</FieldLabel>
              <Input
                id="mint-label"
                value={mintLabel}
                onChange={(e) => setMintLabel(e.target.value)}
                placeholder="e.g. Production backend"
                maxLength={100}
              />
              <FieldDescription>
                Optional — helps you identify this credential later.
              </FieldDescription>
            </Field>
            {mintError && <FieldError>{mintError}</FieldError>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeMintDialog}
                disabled={minting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={minting}>
                {minting && <Spinner />}
                Mint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time secret reveal */}
      <Dialog
        open={!!mintedSecret}
        onOpenChange={(open) => !open && setMintedSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <WarningIcon className="size-4" />
              Save this secret now
            </DialogTitle>
            <DialogDescription>
              This is the only time this secret will ever be shown. Store it
              somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Key ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-none border border-border bg-muted px-3 py-2 font-mono text-xs">
                  {mintedSecret?.keyId}
                </code>
                <CopyButton
                  value={mintedSecret?.keyId ?? ""}
                  label="Key ID"
                  variant="outline"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-none border border-border bg-muted px-3 py-2 font-mono text-xs">
                  {mintedSecret?.secret}
                </code>
                <CopyButton
                  value={mintedSecret?.secret ?? ""}
                  label="Secret"
                  variant="outline"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setMintedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke credential */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this credential?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.label || revokeTarget?.keyId} will immediately
              stop authenticating. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && (
            <p className="text-xs text-destructive">{revokeError}</p>
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
