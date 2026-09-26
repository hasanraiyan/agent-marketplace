"use client";

import * as React from "react";
import Link from "next/link";
import {
  CodeIcon,
  CopyIcon,
  CheckIcon,
  TerminalIcon,
  LightningIcon,
  ShieldCheckIcon,
  KeyIcon,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AgentCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName?: string;
  projectId: string;
  contextKeys?: string[];
}

export function AgentCodeDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  projectId,
  contextKeys = [],
}: AgentCodeDialogProps) {
  const [format, setFormat] = React.useState<"esm" | "cjs">("esm");
  const [mode, setMode] = React.useState<"streaming" | "simple">("streaming");
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedInstall, setCopiedInstall] = React.useState(false);

  const installCmd = "npm install @personaai/sdk";

  const generatedCode = React.useMemo(() => {
    const isEsm = format === "esm";
    const isStreaming = mode === "streaming";
    const displayName = agentName || "Agent";

    const contextSnippet =
      contextKeys && contextKeys.length > 0
        ? `    context: {\n${contextKeys
            .map((k) => `      ${k}: 'sample_${k}_value',`)
            .join("\n")}\n    },`
        : "    // context: { userEmail: 'user@example.com' }, // Optional: Turn context for RCP tools";

    if (isEsm) {
      if (isStreaming) {
        return `import { PersonaClient } from '@personaai/sdk';

// Initialize the Persona Client
const client = new PersonaClient({
  baseUrl: process.env.PERSONA_BASE_URL || 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_API_KEY!, // Project Credential Secret Key
  externalUserId: 'user_123', // Your authenticated end-user ID
});

async function main() {
  console.log('Starting stream for ${displayName} (${agentId})...');

  // Stream real-time AG-UI events and message tokens
  const eventStream = client.chat.stream('${agentId}', {
    messages: [
      { role: 'user', content: 'Hello! How can you help me today?' },
    ],
${contextSnippet}
  });

  for await (const event of eventStream) {
    if (event.type === 'text_message_chunk') {
      process.stdout.write(event.delta || '');
    } else if (event.type === 'custom') {
      // Custom events, HITL interrupts, subagent state, or tool activity
      console.log(\`\\n[Event: \${event.name}]\`);
    }
  }
}

main().catch(console.error);
`;
      } else {
        return `import { PersonaClient } from '@personaai/sdk';

// Initialize the Persona Client
const client = new PersonaClient({
  baseUrl: process.env.PERSONA_BASE_URL || 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_API_KEY!, // Project Credential Secret Key
  externalUserId: 'user_123', // Your authenticated end-user ID
});

async function main() {
  // Send turn and await assembled response
  const response = await client.chat.sendMessage('${agentId}', {
    messages: [
      { role: 'user', content: 'Hello! How can you help me today?' },
    ],
${contextSnippet}
  });

  console.log('Response:', response.text);
}

main().catch(console.error);
`;
      }
    } else {
      // CommonJS
      if (isStreaming) {
        return `const { PersonaClient } = require('@personaai/sdk');

// Initialize the Persona Client
const client = new PersonaClient({
  baseUrl: process.env.PERSONA_BASE_URL || 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_API_KEY, // Project Credential Secret Key
  externalUserId: 'user_123', // Your authenticated end-user ID
});

async function main() {
  console.log('Starting stream for ${displayName} (${agentId})...');

  // Stream real-time AG-UI events and message tokens
  const eventStream = client.chat.stream('${agentId}', {
    messages: [
      { role: 'user', content: 'Hello! How can you help me today?' },
    ],
${contextSnippet}
  });

  for await (const event of eventStream) {
    if (event.type === 'text_message_chunk') {
      process.stdout.write(event.delta || '');
    } else if (event.type === 'custom') {
      console.log(\`\\n[Event: \${event.name}]\`);
    }
  }
}

main().catch(console.error);
`;
      } else {
        return `const { PersonaClient } = require('@personaai/sdk');

// Initialize the Persona Client
const client = new PersonaClient({
  baseUrl: process.env.PERSONA_BASE_URL || 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_API_KEY, // Project Credential Secret Key
  externalUserId: 'user_123', // Your authenticated end-user ID
});

async function main() {
  const response = await client.chat.sendMessage('${agentId}', {
    messages: [
      { role: 'user', content: 'Hello! How can you help me today?' },
    ],
${contextSnippet}
  });

  console.log('Response:', response.text);
}

main().catch(console.error);
`;
      }
    }
  }, [format, mode, agentId, agentName, contextKeys]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInstall = async () => {
    await navigator.clipboard.writeText(installCmd);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-2xl md:max-w-3xl">
        <DialogHeader className="gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CodeIcon className="size-4 text-primary" />
              Integration Code
              {agentName && (
                <Badge variant="secondary" className="font-normal text-xs">
                  {agentName}
                </Badge>
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Run this agent in your Node.js or TypeScript backend using the official{" "}
            <code className="font-mono text-[11px] font-semibold text-foreground">
              @personaai/sdk
            </code>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Package installation bar */}
          <div className="flex items-center justify-between gap-2 rounded-none border border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-xs text-foreground min-w-0">
              <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{installCmd}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyInstall}
              className="h-7 shrink-0 gap-1 text-xs"
            >
              {copiedInstall ? (
                <>
                  <CheckIcon className="size-3 text-primary" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* Options Toolbar: Language Tabs + Execution Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Format:</span>
              <Tabs
                value={format}
                onValueChange={(val) => setFormat(val as "esm" | "cjs")}
              >
                <TabsList className="h-7 bg-muted/60 p-0.5">
                  <TabsTrigger value="esm" className="h-6 text-xs px-2.5">
                    TypeScript / ESM
                  </TabsTrigger>
                  <TabsTrigger value="cjs" className="h-6 text-xs px-2.5">
                    CommonJS
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Pattern:</span>
              <Tabs
                value={mode}
                onValueChange={(val) => setMode(val as "streaming" | "simple")}
              >
                <TabsList className="h-7 bg-muted/60 p-0.5">
                  <TabsTrigger value="streaming" className="h-6 text-xs px-2.5 gap-1">
                    <LightningIcon className="size-3 text-amber-500" />
                    Streaming (AG-UI)
                  </TabsTrigger>
                  <TabsTrigger value="simple" className="h-6 text-xs px-2.5">
                    Single Response
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Code Viewer Box */}
          <div className="relative rounded-none border border-border bg-neutral-950 font-mono text-[11px] text-neutral-100 shadow-inner">
            <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-3 py-1.5">
              <span className="text-[10px] text-neutral-400">
                {format === "esm" ? "agent-runner.ts" : "agent-runner.js"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-6 gap-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                {copiedCode ? (
                  <>
                    <CheckIcon className="size-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied to clipboard</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-3" />
                    <span>Copy code</span>
                  </>
                )}
              </Button>
            </div>

            <pre className="max-h-[380px] overflow-x-auto p-4 leading-relaxed whitespace-pre font-mono selection:bg-primary/30">
              <code>{generatedCode}</code>
            </pre>
          </div>

          {/* Credentials info footer */}
          <div className="flex flex-col gap-2 rounded-none border border-dashed border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 shrink-0 text-blue-500" />
              <span>
                Set <code className="font-mono text-foreground">PERSONA_API_KEY</code> from your Project Credentials.
              </span>
            </div>
            <Link
              href={`/projects/${projectId}/credentials`}
              target="_blank"
              className="font-medium text-primary underline underline-offset-4 shrink-0"
            >
              Get Project API Key
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
