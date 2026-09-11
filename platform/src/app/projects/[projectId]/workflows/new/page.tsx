"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, TreeStructureIcon, SparkleIcon, LightningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProjectWorkflow } from "@/lib/api/projects";

const TEMPLATES = [
  {
    id: "blank",
    title: "Blank Canvas",
    description: "Start fresh with a minimal Manual Trigger and Output node.",
    icon: TreeStructureIcon,
    draft: {
      nodes: [
        {
          id: "trigger_1",
          type: "trigger",
          position: { x: 100, y: 150 },
          data: { label: "Manual Trigger", config: { type: "manual" } },
        },
        {
          id: "output_1",
          type: "output",
          position: { x: 550, y: 150 },
          data: { label: "Output", config: {} },
        },
      ],
      edges: [{ id: "e_start", source: "trigger_1", target: "output_1" }],
      trigger: { type: "manual", config: {} },
    },
  },
  {
    id: "sequential_agents",
    title: "Sequential Multi-Agent Pipeline",
    description: "Chain two specialized agents: Triage Agent followed by Specialist Agent.",
    icon: SparkleIcon,
    draft: {
      nodes: [
        {
          id: "trigger_1",
          type: "trigger",
          position: { x: 100, y: 150 },
          data: { label: "User Input Trigger", config: { type: "manual" } },
        },
        {
          id: "agent_triage",
          type: "agentStep",
          position: { x: 380, y: 150 },
          data: {
            label: "Triage Agent",
            config: {
              inputTemplate: "{{trigger.payload.query}}",
              systemOverrideTemplate: "You are a triage specialist. Classify and summarize the request.",
            },
          },
        },
        {
          id: "agent_responder",
          type: "agentStep",
          position: { x: 680, y: 150 },
          data: {
            label: "Specialist Agent",
            config: {
              inputTemplate: "Context from triage: {{steps.agent_triage.output.text}}\n\nOriginal: {{trigger.payload.query}}",
            },
          },
        },
        {
          id: "output_1",
          type: "output",
          position: { x: 980, y: 150 },
          data: {
            label: "Final Result",
            config: { outputMapping: "{{steps.agent_responder.output.text}}" },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger_1", target: "agent_triage" },
        { id: "e2", source: "agent_triage", target: "agent_responder" },
        { id: "e3", source: "agent_responder", target: "output_1" },
      ],
      trigger: { type: "manual", config: {} },
    },
  },
  {
    id: "rag_augmented",
    title: "Knowledge RAG + Reasoning",
    description: "Search Project knowledge base, then summarize with an Agent step.",
    icon: LightningIcon,
    draft: {
      nodes: [
        {
          id: "trigger_1",
          type: "trigger",
          position: { x: 100, y: 150 },
          data: { label: "Trigger", config: { type: "manual" } },
        },
        {
          id: "knowledge_search",
          type: "knowledgeStep",
          position: { x: 380, y: 150 },
          data: {
            label: "Search Knowledge",
            config: { queryTemplate: "{{trigger.payload.query}}", topK: 5 },
          },
        },
        {
          id: "agent_synthesizer",
          type: "agentStep",
          position: { x: 680, y: 150 },
          data: {
            label: "Synthesizer Agent",
            config: {
              inputTemplate: "Answer question based on documents:\n\n{{steps.knowledge_search.output.documents}}\n\nQuestion: {{trigger.payload.query}}",
            },
          },
        },
        {
          id: "output_1",
          type: "output",
          position: { x: 980, y: 150 },
          data: {
            label: "Answer",
            config: { outputMapping: "{{steps.agent_synthesizer.output.text}}" },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger_1", target: "knowledge_search" },
        { id: "e2", source: "knowledge_search", target: "agent_synthesizer" },
        { id: "e3", source: "agent_synthesizer", target: "output_1" },
      ],
      trigger: { type: "manual", config: {} },
    },
  },
];

export default function NewWorkflowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] = React.useState<"private" | "unlisted" | "public">("private");
  const [externalUserId, setExternalUserId] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState("blank");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Workflow name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const template = TEMPLATES.find((t) => t.id === selectedTemplate) || TEMPLATES[0];
      const res = await createProjectWorkflow(projectId, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        externalUserId: externalUserId.trim() || undefined,
        draft: template.draft,
      });

      const newWorkflow = res.data?.data;
      if (newWorkflow?._id) {
        router.push(`/projects/${projectId}/workflows/${newWorkflow._id}`);
      } else {
        router.push(`/projects/${projectId}/workflows`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to create workflow");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-4"
          render={<Link href={`/projects/${projectId}/workflows`} />}
        >
          <ArrowLeftIcon className="size-4" />
          <span>Back to Workflows</span>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Workflow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Design a multi-agent orchestration graph with interactive visual editing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name" className="text-sm font-medium">
                Workflow Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="workflow-name"
                placeholder="e.g. Sales Qualification Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow-visibility" className="text-sm font-medium">
                Visibility
              </Label>
              <select
                id="workflow-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="private">Private (Project Admins only)</option>
                <option value="unlisted">Unlisted (Accessible by ID)</option>
                <option value="public">Public (Catalog Discoverable)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-desc" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="workflow-desc"
              placeholder="What does this workflow automate?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-external-user" className="text-sm font-medium">
              External User ID Scope <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="workflow-external-user"
              placeholder="e.g. usr_1042 (Assigns ownership to external customer)"
              value={externalUserId}
              onChange={(e) => setExternalUserId(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              If specified, this workflow will be scoped and owned by this external user within this Project.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Choose Starter Template</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              const isSelected = selectedTemplate === tmpl.id;
              return (
                <Card
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`cursor-pointer transition-all border ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                      : "hover:border-foreground/20 hover:bg-muted/30"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-md ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <CardTitle className="text-sm font-medium">{tmpl.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <CardDescription className="text-xs">{tmpl.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? "Creating..." : "Create & Open Canvas"}
          </Button>
          <Button
            type="button"
            variant="outline"
            render={<Link href={`/projects/${projectId}/workflows`} />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
