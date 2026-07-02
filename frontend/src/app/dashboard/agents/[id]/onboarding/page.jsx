"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAgent } from "@/lib/api/agents";
import { PersonaOnboardingWizard } from "@/components/agents/persona-onboarding-wizard";

export default function Page({ params }) {
  const { id } = use(params);
  const [agentName, setAgentName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAgent(id)
      .then((res) => {
        if (!cancelled) setAgentName(res.data?.data?.name || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return <PersonaOnboardingWizard agentId={id} agentName={agentName} />;
}
