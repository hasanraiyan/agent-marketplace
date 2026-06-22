"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Wrap in requestAnimationFrame to satisfy linting if it's strict about synchronous updates
    // although standard pattern for next-themes is usually just setMounted(true)
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  useDashboardHeader({
    title: "Appearance",
    description: "Customize the look and feel of your workspace.",
  });

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Theme Preferences</CardTitle>
            <CardDescription>
              Choose how the application appears to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-48 animate-pulse bg-muted/20 rounded-md" />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Theme Preferences</CardTitle>
          <CardDescription>
            Choose how the application appears to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            defaultValue={theme}
            value={theme}
            onValueChange={(value) => setTheme(value)}
            className="grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3"
          >
            <div>
              <Label
                htmlFor="light"
                className="cursor-pointer [&:has([data-state=checked])>div]:border-primary"
              >
                <RadioGroupItem value="light" id="light" className="sr-only" />
                <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                  <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                    <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                      <div className="h-2 w-20 rounded-lg bg-[#ecedef]" />
                      <div className="h-2 w-24 rounded-lg bg-[#ecedef]" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div className="size-4 rounded-full bg-[#ecedef]" />
                      <div className="h-2 w-24 rounded-lg bg-[#ecedef]" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                      <div className="size-4 rounded-full bg-[#ecedef]" />
                      <div className="h-2 w-24 rounded-lg bg-[#ecedef]" />
                    </div>
                  </div>
                </div>
                <span className="mt-2 block w-full text-center font-medium">
                  Light
                </span>
              </Label>
            </div>

            <div>
              <Label
                htmlFor="dark"
                className="cursor-pointer [&:has([data-state=checked])>div]:border-primary"
              >
                <RadioGroupItem value="dark" id="dark" className="sr-only" />
                <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                  <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                    <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div className="h-2 w-20 rounded-lg bg-slate-400" />
                      <div className="h-2 w-24 rounded-lg bg-slate-400" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div className="size-4 rounded-full bg-slate-400" />
                      <div className="h-2 w-24 rounded-lg bg-slate-400" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                      <div className="size-4 rounded-full bg-slate-400" />
                      <div className="h-2 w-24 rounded-lg bg-slate-400" />
                    </div>
                  </div>
                </div>
                <span className="mt-2 block w-full text-center font-medium">
                  Dark
                </span>
              </Label>
            </div>

            <div>
              <Label
                htmlFor="system"
                className="cursor-pointer [&:has([data-state=checked])>div]:border-primary"
              >
                <RadioGroupItem value="system" id="system" className="sr-only" />
                <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                  <div className="flex space-x-0 rounded-sm bg-[#ecedef] p-0 overflow-hidden">
                    <div className="flex-1 space-y-2 p-2">
                      <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                        <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
                        <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                        <div className="size-4 rounded-full bg-[#ecedef]" />
                        <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 bg-slate-950 p-2">
                      <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                        <div className="h-2 w-full rounded-lg bg-slate-400" />
                        <div className="h-2 w-full rounded-lg bg-slate-400" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                        <div className="size-4 rounded-full bg-slate-400" />
                        <div className="h-2 w-full rounded-lg bg-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="mt-2 block w-full text-center font-medium">
                  System
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
