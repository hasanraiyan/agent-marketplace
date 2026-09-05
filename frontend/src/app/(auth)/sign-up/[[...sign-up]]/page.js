"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  AuthField,
  CARD_CLASS,
  GlobalAuthError,
  OrDivider,
  SocialButton,
  submitButtonClass,
} from "@/components/auth/auth-ui";
import { socialProviders, attributes } from "@/lib/clerk-auth-config.json";

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

  const showFirstName = attributes.first_name?.enabled;
  const showLastName = attributes.last_name?.enabled;
  const showUsername = attributes.username?.enabled;
  const showEmail = attributes.email_address?.enabled;

  const finalizeAndGo = async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => router.push(decorateUrl("/dashboard")),
    });
  };

  const handleDetails = async (e) => {
    e.preventDefault();
    const params = { password };
    if (showEmail) params.emailAddress = emailAddress;
    if (showUsername) params.username = username;
    if (showFirstName && firstName) params.firstName = firstName;
    if (showLastName && lastName) params.lastName = lastName;

    const { error } = await signUp.password(params);
    if (error) return;

    if (signUp.status === "complete") {
      await finalizeAndGo();
      return;
    }

    if (signUp.unverifiedFields.includes("email_address")) {
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) return;
      setStep("verify");
      return;
    }

    setStep("unsupported");
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status === "complete") await finalizeAndGo();
    else setStep("unsupported");
  };

  const handleSocial = async (strategy) => {
    await signUp.sso({
      strategy,
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      redirectUrl: "/dashboard",
    });
  };

  if (step === "unsupported") {
    return (
      <div className={CARD_CLASS}>
        <h1 className="font-display text-2xl font-semibold text-zinc-900">
          Almost there
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Your account needs one more step that isn&apos;t supported here yet.
          Contact support or try again shortly.
        </p>
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

      {socialProviders.length > 0 && (
        <>
          <div className="mt-6 flex flex-col gap-2.5">
            {socialProviders.map((provider) => (
              <SocialButton
                key={provider.strategy}
                provider={provider}
                disabled={busy}
                onClick={() => handleSocial(provider.strategy)}
              />
            ))}
          </div>
          <div className="my-6">
            <OrDivider />
          </div>
        </>
      )}

      <form
        onSubmit={handleDetails}
        className={`flex flex-col gap-4 ${socialProviders.length > 0 ? "" : "mt-6"}`}
      >
        {(showFirstName || showLastName) && (
          <div className="grid grid-cols-2 gap-3">
            {showFirstName && (
              <AuthField
                id="first-name"
                label="First name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={errors?.fields?.firstName}
                required={attributes.first_name?.required}
              />
            )}
            {showLastName && (
              <AuthField
                id="last-name"
                label="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                error={errors?.fields?.lastName}
                required={attributes.last_name?.required}
              />
            )}
          </div>
        )}
        {showUsername && (
          <AuthField
            id="username"
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors?.fields?.username}
            required={attributes.username?.required}
          />
        )}
        {showEmail && (
          <AuthField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            error={errors?.fields?.emailAddress}
            required={attributes.email_address?.required}
          />
        )}
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors?.fields?.password}
          required={attributes.password?.required}
        />
        <div id="clerk-captcha" className="flex justify-center empty:hidden" />
        <GlobalAuthError errors={errors} />
        <Button type="submit" disabled={busy} className={submitButtonClass}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-[#1E60FF] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
