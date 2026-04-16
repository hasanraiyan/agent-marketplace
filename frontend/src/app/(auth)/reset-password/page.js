"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlertIcon, LockIcon } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-up w-full max-w-md">
      <Card className="glass border-border/40 shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <LockIcon className="size-5 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Reset password
          </CardTitle>
          <CardDescription>
            Choose a strong password to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              className="bg-muted/30 focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              className="bg-muted/30 focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/20">
            <div className="flex gap-2">
              <ShieldAlertIcon className="mt-0.5 size-4 text-primary" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-primary">Security Tip:</p>
                Use at least 8 characters with a mix of letters, numbers, and
                symbols.
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            className="w-full gap-2 glow-primary"
            id="reset-confirm-submit"
          >
            Set new password
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Wait, I remember it!{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
