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
import { cacheKey, deleteCachedByPrefix, getCached, setCached, dedupedFetch } from "@/lib/cache";

interface Credential {
  _id?: string;
  id: string;
  keyId: string;
  label?: string;
  status: "ACTIVE" | "REVOKED" | string;
  createdAt?: string;
  revokedAt?: string | null;
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

function maskKeyId(keyId: string) {
  // Only the start of the key is shown — the full value is still copied
  // from the row's copy button.
  return keyId.length > 12 ? `${keyId.slice(0, 12)}…` : keyId;
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
    const key = cacheKey.resource(projectId, "credentials");
    const cached = getCached<Credential[]>(key);
    if (cached) setCredentials(cached);
    dedupedFetch<Credential[]>(
      key,
      () =>
        getProjectCredentials(projectId).then((res) => {
          const raw = res.data?.data;
          return (Array.isArray(raw) ? raw : (raw?.items ?? raw ?? [])) as Credential[];
        })
    )
      .then((normalized) => {
        if (cancelled) return;
        setCached(key, normalized);
        setCredentials(normalized);
      })
      .catch((err) => {
        if (!cancelled && !cached) {
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
      deleteCachedByPrefix(cacheKey.resource(projectId, "credentials"));
      // Optimistically update local + cache
      setCredentials((prev) => {
        const next = [credential, ...(prev ?? [])] as Credential[];
        setCached(cacheKey.resource(projectId, "credentials"), next);
        return next;
      });
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
      deleteCachedByPrefix(cacheKey.resource(projectId, "credentials"));
      setCredentials((prev) => {
        const next = (prev ?? []).map((c) => ((c._id || c.id) === credentialId ? res.data?.data ?? c : c)) as Credential[];
        setCached(cacheKey.resource(projectId, "credentials"), next);
        return next;
      });
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(errorMessage(err, "Failed to revoke credential."));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 truncate text-base sm:text-sm">
              <KeyIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Credentials</span>
            </CardTitle>
            <CardDescription className="line-clamp-3 max-w-xl text-[11px] leading-snug sm:line-clamp-none sm:text-xs">
              API credentials this Project&apos;s SDK uses — separate from your Clerk session in Studio. Secret is shown once on mint.
            </CardDescription>
          </div>
          <Button size="sm" className="w-fit shrink-0" onClick={() => setMintOpen(true)}>
            <KeyIcon data-icon="inline-start" />
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
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key ID</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((c) => (
                      <TableRow key={c._id || c.id || c.keyId}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {maskKeyId(c.keyId)}
                            </span>
                            <CopyButton
                              value={c.keyId}
                              size="icon-xs"
                              className="size-6"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">{c.label || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={c.status === "ACTIVE" ? "outline" : "secondary"}
                            className={credentialBadgeClass(c)}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === "ACTIVE" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="bg-destructive text-white hover:bg-destructive/90 hover:text-white"
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
              {/* Mobile stacked cards */}
              <div className="flex flex-col gap-2 sm:hidden">
                {credentials.map((c) => (
                  <div
                    key={c._id || c.id || c.keyId}
                    className="flex flex-col gap-2 rounded-none border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {maskKeyId(c.keyId)}
                      </span>
                      <CopyButton
                        value={c.keyId}
                        size="icon-xs"
                        className="size-6"
                      />
                      <Badge
                        variant={c.status === "ACTIVE" ? "outline" : "secondary"}
                        className={credentialBadgeClass(c)}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    {c.label && <span className="truncate text-xs text-muted-foreground">{c.label}</span>}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {c.lastUsedAt ? `Used ${new Date(c.lastUsedAt).toLocaleDateString()}` : "Never used"}
                        {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString()}` : ""}
                      </span>
                      {c.status === "ACTIVE" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 bg-destructive px-2 text-xs text-white hover:bg-destructive/90 hover:text-white"
                          onClick={() => setRevokeTarget(c)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {c.revokedAt ? new Date(c.revokedAt).toLocaleDateString() : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
