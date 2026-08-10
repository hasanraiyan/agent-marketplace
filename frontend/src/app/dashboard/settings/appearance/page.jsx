"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDashboardHeader } from "@/components/dashboard-header-context";

export default function AppearanceSettingsPage() {
  useDashboardHeader({
    title: "Appearance",
    description: "Customize the look and feel of your workspace.",
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Theme Preferences</CardTitle>
          <CardDescription>
            Choose how the application appears to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Appearance settings are coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
