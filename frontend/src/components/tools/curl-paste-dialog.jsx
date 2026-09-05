"use client";

import { useState } from "react";
import { toast } from "sonner";
import { parseCurl } from "@/lib/curl-parser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * "Paste it to auto-fill the form" — parses a pasted cURL command and
 * hands the result back to the builder's Step 2 form state.
 */
export function CurlPasteDialog({ onParsed }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");

  const handleImport = () => {
    if (!raw.trim()) {
      toast.error("Paste a cURL command first");
      return;
    }
    const parsed = parseCurl(raw);
    if (!parsed.url) {
      toast.error("Couldn't find a URL in that command");
      return;
    }
    onParsed(parsed);
    for (const warning of parsed.warnings) toast.warning(warning);
    toast.success("Form auto-filled from cURL.");
    setOpen(false);
    setRaw("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <Textarea
          autoFocus
          rows={8}
          placeholder={`curl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"..."}'`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleImport}>
            Auto-fill form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
