"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  AuthField,
  GlobalAuthError,
  GoogleButton,
  OrDivider,
  submitButtonClass,
} from "@/components/auth/auth-ui";

const CARD_CLASS =
  "w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const busy = fetchStatus === "fetching";

  const [step, setStep] = useState("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const finalizeAndGo = async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => router.push(decorateUrl("/dashboard")),
    });
  };

  const handleDetails = async (e) => {
    e.preventDefault();
    const { error } = await signUp.password({
      emailAddress,
      password,
      username,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });
    if (error) return;

    if (signUp.status === "complete") {
      await finalizeAndGo();
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return;
    setStep("verify");
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status === "complete") await finalizeAndGo();
  };

  const handleGoogle = async () => {
    await signUp.sso({
      strategy: "oauth_google",
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      redirectUrl: "/dashboard",
    });
  };

  if (step === "verify") {
    return (
      <div className={CARD_CLASS}>
        <h1 className="font-display text-2xl font-semibold text-zinc-900">
          Check your email
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Enter the code we sent to {emailAddress}.
        </p>

        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <AuthField
            id="code"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors?.fields?.code}
            required
          />
          <GlobalAuthError errors={errors} />
          <Button type="submit" disabled={busy} className={submitButtonClass}>
            Verify email
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setStep("details")}
          className="mt-6 text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <h1 className="font-display text-2xl font-semibold text-zinc-900">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-zinc-500">
        Free to start — bring your own model key when you build.
      </p>

      <div className="mt-6">
        <GoogleButton onClick={handleGoogle} disabled={busy} />
      </div>

      <div className="my-6">
        <OrDivider />
      </div>

      <form onSubmit={handleDetails} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="first-name"
            label="First name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            error={errors?.fields?.firstName}
          />
          <AuthField
            id="last-name"
            label="Last name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            error={errors?.fields?.lastName}
          />
        </div>
        <AuthField
          id="username"
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors?.fields?.username}
          required
        />
        <AuthField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          error={errors?.fields?.emailAddress}
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors?.fields?.password}
          required
        />
        <div id="clerk-captcha" className="flex justify-center empty:hidden" />
        <GlobalAuthError errors={errors} />
        <Button type="submit" disabled={busy} className={submitButtonClass}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-[#1E60FF] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
