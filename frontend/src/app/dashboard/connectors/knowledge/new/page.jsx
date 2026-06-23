"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { toast } from "sonner";
import { useConnectors } from "../../connectors-context";

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const { createKb } = useConnectors();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for your knowledge base");
      return;
    }

    setCreating(true);
    try {
      const kb = await createKb({ name: name.trim(), description: description.trim() });
      toast.success("Knowledge base created!");
      router.push(`/dashboard/connectors/knowledge/${kb._id || kb.id}`);
    } catch (err) {
      // Toast already handles this
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex justify-center py-12 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
            <BookText className="size-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              New Knowledge Base
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a collection of documents for your agents to search
            </p>
          </div>
        </div>

        {/* Name */}
        <Field>
          <FieldLabel className="text-sm font-bold">Name</FieldLabel>
          <Input
            placeholder="e.g. Company Handbook, API Documentation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-muted/20"
            required
          />
        </Field>

        {/* Description */}
        <Field>
          <FieldLabel className="text-sm font-bold">Description</FieldLabel>
          <Textarea
            placeholder="What kind of documents will this knowledge base contain?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-muted/20"
          />
          <FieldDescription className="text-xs">
            A clear description helps your agent understand when to search this knowledge base.
          </FieldDescription>
        </Field>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-base font-bold shadow-lg shadow-emerald-500/20"
          disabled={creating || !name.trim()}
        >
          {creating ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : (
            <BookText className="mr-2 size-5" />
          )}
          Create Knowledge Base
        </Button>
      </form>
    </div>
  );
}
