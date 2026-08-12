"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SSOCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      if (!clerk.loaded || hasRun.current) return;
      hasRun.current = true;

      const goHome = ({ decorateUrl }) => router.push(decorateUrl("/dashboard"));

      if (signIn.status === "complete") {
        await signIn.finalize({ navigate: goHome });
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize({ navigate: goHome });
        return;
      }

      if (signUp.isTransferable) {
        const { error } = await signIn.create({ transfer: true });
        if (!error && signIn.status === "complete") {
          await signIn.finalize({ navigate: goHome });
          return;
        }
      }

      setFailed(true);
    })();
  }, [clerk, signIn, signUp, router]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div id="clerk-captcha" className="empty:hidden" />
      {failed ? (
        <>
          <p className="text-sm text-zinc-600">
            We couldn&apos;t finish signing you in with Google.
          </p>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-[#1E60FF] hover:underline"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-[#1E60FF]" />
          <p className="text-sm text-zinc-500">Finishing sign-in…</p>
        </>
      )}
    </div>
  );
}
