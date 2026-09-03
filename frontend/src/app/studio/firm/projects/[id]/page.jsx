"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { getMyFirmProjects } from "@/lib/api/firms";
import { studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { FirmEmpty, RequireFirm } from "@/components/studio/firm-primitives";
import { FirmProjectForm } from "@/components/studio/firm-project-form";

function ProjectLoader({ id }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // No single-template GET on the owner API; the list is small.
        const res = await getMyFirmProjects();
        const found = (res.data?.data || []).find((p) => p._id === id) || null;
        if (!cancelled) setProject(found);
      } catch (err) {
        if (!cancelled)
          toast.error(err.response?.data?.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (!project) {
    return (
      <FirmEmpty
        icon={PackageIcon}
        title="Project not found"
        description="It may have been deleted, or the link is from another firm."
        action={
          <Link href={studioRoutes.firmProjects}>
            <Button variant="outline" className="rounded-full font-bold">
              Back to projects
            </Button>
          </Link>
        }
      />
    );
  }
  return <FirmProjectForm mode="edit" project={project} />;
}

export default function EditFirmProjectPage({ params }) {
  const { id } = use(params);
  const { firm } = useFirm();

  useDashboardHeader(
    {
      title: "Edit Project",
      description: firm?.name ? `A project sold by ${firm.name}.` : "",
      actions: (
        <Link href={studioRoutes.firmProjects}>
          <Button variant="outline" size="sm" className="rounded-full font-bold">
            <ArrowLeftIcon className="mr-1.5 size-3.5" />
            All projects
          </Button>
        </Link>
      ),
    },
    [firm?.name],
  );

  return (
    <RequireFirm>
      <ProjectLoader id={id} />
    </RequireFirm>
  );
}
