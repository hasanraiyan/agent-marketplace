"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseCurl, type CurlParseResult } from "@/lib/curl-parser";

/**
 * "Paste it to auto-fill the form" — parses a pasted cURL command and
 * hands the result back to the builder's Step 2 form state.
 */
function CurlPasteDialog({ onParsed }: { onParsed: (parsed: CurlParseResult) => void }) {
  const [open, setOpen] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const handleImport = () => {
    if (!raw.trim()) {
      setError("Paste a cURL command first");
      return;
    }
    const parsed = parseCurl(raw);
    if (!parsed.url) {
      setError("Couldn't find a URL in that command");
      return;
    }
    onParsed(parsed);
    setWarnings(parsed.warnings);
    setError(null);
    setOpen(false);
    setRaw("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError(null);
          setRaw("");
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-primary underline underline-offset-4 hover:no-underline"
      >
        Have a cURL command? Paste it to auto-fill the form →
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste a cURL command</DialogTitle>
          <DialogDescription>
            Method, URL, headers, params, and body will be filled in
            automatically. Common flags only — review the result afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            rows={8}
            placeholder={`curl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"..."}'`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="font-mono text-xs"
          />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport}>
            Auto-fill form
          </Button>
        </DialogFooter>
        {warnings.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <span key={i} className="block">
                ⚠ {w}
              </span>
            ))}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CurlPasteDialog };