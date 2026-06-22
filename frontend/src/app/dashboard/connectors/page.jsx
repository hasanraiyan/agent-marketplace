"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnectors } from "./connectors-context";

export default function ConnectorsPage() {
  const router = useRouter();
  const { mySkills, mcps, loading, loadingMcps, activeTab } = useConnectors();

  useEffect(() => {
    if (activeTab === "mcps") {
      if (loadingMcps) return;
      if (mcps.length > 0) {
        router.replace(`/dashboard/connectors/mcps/${mcps[0]._id}`);
      } else {
        router.replace("/dashboard/connectors/mcps");
      }
    } else {
      if (loading) return;
      if (mySkills.length > 0) {
        router.replace(`/dashboard/connectors/skills/${mySkills[0]._id || mySkills[0].id}`);
      } else {
        router.replace("/dashboard/connectors/skills");
      }
    }
  }, [mySkills, mcps, loading, loadingMcps, activeTab, router]);

  return null;
}
