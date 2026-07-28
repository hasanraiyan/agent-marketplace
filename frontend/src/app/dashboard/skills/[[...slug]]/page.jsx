"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SkillsRedirect({ params }) {
  const router = useRouter();
  const { slug } = params;

  useEffect(() => {
    // First check for ?tab=mcps query param
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const tab = url.searchParams.get("tab");

      if (tab === "mcps") {
        // Also pass through mcpId and connected params for OAuth callback
        const mcpId = url.searchParams.get("mcpId");
        const connected = url.searchParams.get("connected");
        const error = url.searchParams.get("error");
        let target = "/studio/connectors";
        const params = new URLSearchParams();
        if (mcpId) params.set("mcpId", mcpId);
        if (connected) params.set("connected", connected);
        if (error) params.set("error", error);
        const qs = params.toString();
        if (qs) target += `?${qs}`;
        router.replace(target);
        return;
      }
    }

    if (!slug || slug.length === 0) {
      router.replace("/studio/skills");
      return;
    }

    const path = slug.join("/");
    router.replace(`/studio/skills/${path}`);
  }, [slug, router]);

  return null;
}
