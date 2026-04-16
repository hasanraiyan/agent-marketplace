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
import { ArrowLeftIcon, MailIcon, KeyIcon } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up w-full max-w-md">
      <Card className="glass border-border/40 shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <KeyIcon className="size-5 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Forgot password?
          </CardTitle>
          <CardDescription>
            No worries, we&apos;ll send you reset instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <MailIcon className="absolute top-3 left-3 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                className="bg-muted/30 pl-10 focus-visible:ring-primary/30"
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            className="w-full gap-2 glow-primary"
            id="reset-request-submit"
          >
            Reset password
          </Button>
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
