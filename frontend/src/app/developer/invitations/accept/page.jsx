"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Loader2, CheckCircle2, Hourglass, ArrowRight } from "lucide-react";
import { getProject } from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Post-accept landing page — the `redirectUrl` Clerk sends the invitee to
 * after they accept an invitation (created in projectInvitation.service.js).
 *
 * The Admin membership is granted server-side by the invitation.accepted
 * webhook, which can lag the redirect by a moment, so this page polls
 * GET /projects/:id until membership resolves (or gives up gracefully).
 * Public (see middleware.js) — a signed-out visitor is pointed at sign-in
 * with a redirect back here.
 */
export default function InvitationAcceptPage({
  searchParams: searchParamsPromise,
}) {
  const searchParams = React.use(searchParamsPromise);
  const email =
    typeof searchParams?.email === "string" ? searchParams.email : "";
  const projectId =
    typeof searchParams?.projectId === "string" ? searchParams.projectId : "";
  const { isLoaded, isSignedIn } = useAuth();

  // checking → granted | waiting | invalid; signed-out is derived at render.
  // `projectId` is known before mount, so a missing one can seed `invalid`
  // without a synchronous setState in the effect.
  const [status, setStatus] = useState(() =>
    projectId ? "checking" : "invalid",
  );
  // Bumping this re-runs the polling effect (the "Check again" button).
  const [retryKey, setRetryKey] = useState(0);

  const backToAccept = `/developer/invitations/accept?email=${encodeURIComponent(email)}&projectId=${encodeURIComponent(projectId)}`;

  useEffect(() => {
    if (!isLoaded) return;
    if (!projectId) return; // seeded as "invalid" above
    if (!isSignedIn) return; // signed-out UI is derived at render

    let cancelled = false;
    let attempts = 0;

    // Poll until the invitation.accepted webhook grants membership (404 →
    // not a member yet), at most ~30s. setState only runs in async
    // continuations (after `await` / in the timer), so the initial state
    // already reads "checking" and "Check again" resets it via onClick.
    const poll = async () => {
      try {
        await getProject(projectId);
        if (!cancelled) setStatus("granted");
      } catch {
        attempts += 1;
        if (cancelled) return;
        if (attempts >= 12) {
          setStatus("waiting");
          return;
        }
        setTimeout(poll, 2500);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, projectId, retryKey]);

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(backToAccept)}`;
  const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(backToAccept)}`;

  const retry = () => {
    setStatus("checking");
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Project invitation</CardTitle>
          <CardDescription>
            {email ? (
              <>
                Invited as an <span className="font-medium">Admin</span> —{" "}
                <span className="font-medium">{email}</span>
              </>
            ) : (
              "You've been invited to join a Project"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-8 text-center">
          {!isLoaded && (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Checking your access…
              </p>
            </>
          )}

          {isLoaded && !isSignedIn && status !== "invalid" && (
            <>
              <Hourglass className="size-10 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                Sign in or create an account to finish accepting your
                invitation.
              </p>
              <div className="flex gap-2">
                <Link href={signInUrl}>
                  <Button variant="outline">Sign in</Button>
                </Link>
                <Link href={signUpUrl}>
                  <Button className="!bg-[#1E60FF] !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]">
                    Create account
                  </Button>
                </Link>
              </div>
            </>
          )}

          {isLoaded && isSignedIn && status === "checking" && (
            <>
              <Loader2 className="size-8 animate-spin text-[#1E60FF]" />
              <p className="text-sm text-muted-foreground">
                Activating your Admin access — this takes a moment.
              </p>
            </>
          )}

          {isLoaded && status === "granted" && (
            <>
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="font-medium">
                {"You're in — Admin access granted!"}
              </p>
              <Link href={developerRoutes.project(projectId)}>
                <Button className="!bg-[#1E60FF] !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]">
                  Open the Project
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </>
          )}

          {isLoaded && status === "waiting" && (
            <>
              <Hourglass className="size-10 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                Access is still being activated. It usually takes a few seconds
                — check again, or contact the Project admin if it stays like
                this.
              </p>
              <Button variant="outline" onClick={retry}>
                Check again
              </Button>
            </>
          )}

          {isLoaded && status === "invalid" && (
            <p className="text-sm text-muted-foreground">
              This invitation link is incomplete. Please use the link from the
              invitation email.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
