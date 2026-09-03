"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { studioRoutes } from "@/lib/studio-routes";
import { RequireFirm } from "@/components/studio/firm-primitives";
import { FirmProjectForm } from "@/components/studio/firm-project-form";

export default function NewFirmProjectPage() {
  useDashboardHeader(
    {
      title: "New Project",
      description: "Package an outcome your firm can deliver.",
      actions: (
        <Link href={studioRoutes.firmProjects}>
          <Button variant="outline" size="sm" className="rounded-full font-bold">
            <ArrowLeftIcon className="mr-1.5 size-3.5" />
            All projects
          </Button>
        </Link>
      ),
    },
    [],
  );

  return (
    <RequireFirm>
      <FirmProjectForm mode="new" />
    </RequireFirm>
  );
}
