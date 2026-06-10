import { useState } from "react";
import { Brain, Copy, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AgentInstructionsCard({ systemPrompt }) {
  const [copied, setCopied] = useState(false);

  if (!systemPrompt) return null;

  const handleCopyText = (text) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Instructions copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-none ring-1 ring-foreground/10 overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            Instructions
          </CardTitle>
          <CardDescription className="text-xs">
            The core guidelines and rules shaping this agent&apos;s behavior.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleCopyText(systemPrompt)}
          className="h-8 rounded-lg px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          {copied ? (
            <>
              <Check className="mr-1.5 size-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-3.5" />
              Copy
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="rounded-xl border bg-muted/20 p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap select-all scrollbar-thin">
            {systemPrompt}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
