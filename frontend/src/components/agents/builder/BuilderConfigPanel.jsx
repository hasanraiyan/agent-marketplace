"use client";

import { AgentForm } from "@/components/agents/agent-form";

export function BuilderConfigPanel({ mode, isEdit, agent, handleManualSave, saving }) {
  return (
    <div className="mx-auto max-w-2xl">
      <AgentForm
        mode={mode}
        initialData={isEdit ? agent : null}
        onSave={handleManualSave}
        loading={saving}
      />
    </div>
  );
}
