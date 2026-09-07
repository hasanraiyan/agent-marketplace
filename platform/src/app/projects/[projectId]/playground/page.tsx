"use client";

import * as React from "react";
import { BookOpen, Target, Brain } from "@phosphor-icons/react";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  VoiceIndicator,
  ThinkingIndicator,
  SubagentSheet,
  WorkspaceFilePanel,
  type ChatMessageData,
  type ChatWorkspaceFile,
} from "@/components/chat";

// Static component-gallery demo, not yet wired to a real agent — the
// useAguiChat hook + useVoiceSession exist (src/lib/agui,
// src/hooks/use-voice-session.ts) but connecting this page to a real
// Agent's actual test-run endpoint is a separate, later step.
const MOCK_MESSAGES: ChatMessageData[] = [
  { id: "m1", role: "user", content: "Can you help me plan a lesson on binary search trees?" },
  {
    id: "m2",
    role: "assistant",
    content:
      "## Binary Search Trees\n\nHere's a plan:\n\n1. **Definition** — ordered nodes, left < parent < right\n2. **Operations** — insert, search, delete\n3. **Complexity** — `O(log n)` balanced, `O(n)` worst case\n\n```js\nfunction insert(node, value) {\n  if (!node) return { value, left: null, right: null };\n  if (value < node.value) node.left = insert(node.left, value);\n  else node.right = insert(node.right, value);\n  return node;\n}\n```\n\nWant a practice problem next?",
    toolCalls: [
      {
        id: "t1",
        name: "write_todos",
        status: "done",
        args: '{"todos":[]}',
        result: "ok",
      },
      {
        id: "t2",
        name: "task",
        status: "done",
        args: '{"description":"Research BST teaching approaches"}',
        result: '{"summary":"done"}',
        subagentMessages: [
          { id: "s1", role: "user", content: "Research common BST teaching approaches." },
          { id: "s2", role: "assistant", content: "Found three common approaches: visual diagrams, step-by-step trace tables, and interactive insert/delete demos." },
        ],
      },
    ],
  },
  { id: "m3", role: "user", content: "Yes, give me a practice problem." },
  {
    id: "m4",
    role: "assistant",
    content: "Working on it…",
    isStreaming: true,
    toolCalls: [{ id: "t3", name: "create_assessment", status: "running" }],
  },
];

export default function PlaygroundPage() {
  const [subagentOpen, setSubagentOpen] = React.useState(false);
  const [workspaceFile, setWorkspaceFile] = React.useState<ChatWorkspaceFile | null>(null);
  const [composerValue, setComposerValue] = React.useState("");
  const [showEmpty, setShowEmpty] = React.useState(false);
  const [showInterruptClarify, setShowInterruptClarify] = React.useState(true);
  const [showInterruptHitl, setShowInterruptHitl] = React.useState(true);

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-8 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">Chat component library — demo</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Thinking indicator</h2>
        <div className="rounded-none border border-border p-4">
          <ThinkingIndicator />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Voice indicator</h2>
        <div className="flex items-center gap-8 rounded-none border border-border p-4">
          <VoiceIndicator state="listening" volume={0.6} size={80} />
          <VoiceIndicator state="speaking" volume={0.8} size={80} />
          <VoiceIndicator state="thinking" size={80} />
          <VoiceIndicator state="idle" size={80} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Empty state</h2>
        <button
          type="button"
          className="self-start text-xs underline"
          onClick={() => setShowEmpty((v) => !v)}
        >
          toggle
        </button>
        {showEmpty && (
          <div className="flex h-64 flex-col rounded-none border border-border">
            <ChatEmptyState
              title="What do you want to learn?"
              description="Ask anything, or pick a starting point."
              starterPrompts={[
                { label: "Explain", icon: BookOpen, template: "Explain " },
                { label: "Practice", icon: Target, template: "Give me a practice problem for " },
                { label: "Quiz", icon: Brain, template: "Quiz me on " },
              ]}
              onSelectPrompt={(t) => setComposerValue(t)}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Messages + tool trace</h2>
        <div className="h-96 rounded-none border border-border">
          <ChatScroller>
            {MOCK_MESSAGES.map((m) => (
              <ChatScrollerItem key={m.id}>
                <ChatMessage
                  message={m}
                  onOpenSubagent={() => setSubagentOpen(true)}
                  onOpenWorkspaceFile={() => {}}
                />
              </ChatScrollerItem>
            ))}
          </ChatScroller>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Clarification interrupt</h2>
        <button
          type="button"
          className="self-start text-xs underline"
          onClick={() => setShowInterruptClarify((v) => !v)}
        >
          toggle
        </button>
        {showInterruptClarify && (
          <InterruptPanel
            interrupt={{
              kind: "clarification",
              questions: [
                {
                  id: "level",
                  question: "What's your current level with data structures?",
                  options: [
                    { value: "beginner", label: "Beginner", description: "New to the topic" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                  ],
                  required: true,
                },
                {
                  id: "goal",
                  question: "What's your goal?",
                  allowCustom: true,
                  required: false,
                },
              ],
            }}
            onSubmitClarification={(answers) => console.log("clarify", answers)}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">HITL interrupt</h2>
        <button
          type="button"
          className="self-start text-xs underline"
          onClick={() => setShowInterruptHitl((v) => !v)}
        >
          toggle
        </button>
        {showInterruptHitl && (
          <InterruptPanel
            interrupt={{
              kind: "hitl",
              actionRequests: [
                {
                  id: "a1",
                  label: "Delete Agent \"Legacy Tutor\"",
                  description: "This cannot be undone.",
                },
              ],
            }}
            onDecideHitl={(id, decision) => console.log("hitl", id, decision)}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Composer (all 4 states)</h2>
        <div className="flex flex-col gap-2 rounded-none border border-border p-3">
          <ChatComposer value={composerValue} onChange={setComposerValue} onSend={() => {}} />
          <ChatComposer value="" onChange={() => {}} onSend={() => {}} isStreaming />
          <ChatComposer value="" onChange={() => {}} onSend={() => {}} isVoiceActive />
          <ChatComposer value="hi" onChange={() => {}} onSend={() => {}} isVoiceActive />
        </div>
      </section>

      <button
        type="button"
        className="self-start text-xs underline"
        onClick={() =>
          setWorkspaceFile({
            path: "/memories/user/index.md",
            title: "index.md",
            content: "# Learner notes\n\nPrefers visual explanations.",
          })
        }
      >
        Open workspace file panel
      </button>

      <SubagentSheet
        open={subagentOpen}
        onOpenChange={setSubagentOpen}
        messages={MOCK_MESSAGES[1].toolCalls![1].subagentMessages!}
      />
      <WorkspaceFilePanel file={workspaceFile} onOpenChange={(open) => !open && setWorkspaceFile(null)} />
    </div>
  );
}
