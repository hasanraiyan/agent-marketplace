"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { RestApiToolEditor } from "@/components/rest-tools/rest-tool-editor";

export default function NewRestToolPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <RestApiToolEditor projectId={projectId} tool={null} mode="new" />;
}