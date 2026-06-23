"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookText, Loader2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getProviders } from "@/lib/api/providers";
import { toast } from "sonner";
import { useConnectors } from "../../connectors-context";

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const { createKb } = useConnectors();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [providerId, setProviderId] = useState("");
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [chunkSize, setChunkSize] = useState("800");
  const [chunkOverlap, setChunkOverlap] = useState("100");
  const [topK, setTopK] = useState("5");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await getProviders();
        const data = res.data?.data || [];
        setProviders(data);
        const defaultProv = data.find(p => p.isDefault) || data[0];
        if (defaultProv) {
          setProviderId(defaultProv._id || defaultProv.id);
        }
      } catch (err) {
        toast.error("Failed to load AI providers");
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for your knowledge base");
      return;
    }
    if (!providerId) {
      toast.error("An AI Provider is required to create a knowledge base");
      return;
    }

    setCreating(true);
    try {
      const kb = await createKb({
        name: name.trim(),
        description: description.trim(),
        embeddingModel,
        providerId,
        chunkSize: parseInt(chunkSize, 10) || 800,
        chunkOverlap: parseInt(chunkOverlap, 10) || 100,
        topK: parseInt(topK, 10) || 5,
      });
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

        {/* Provider */}
        <Field>
          <FieldLabel className="text-sm font-bold">AI Provider (Embedding Key Source)</FieldLabel>
          {loadingProviders ? (
            <div className="text-sm text-muted-foreground pt-1.5 flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Loading providers...
            </div>
          ) : providers.length === 0 ? (
            <div className="text-sm border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 p-3 rounded-xl text-amber-800 dark:text-amber-300 mt-1">
              You need to configure an AI provider first to generate vector embeddings.{" "}
              <button
                type="button"
                onClick={() => router.push("/dashboard/settings/providers")}
                className="underline font-semibold hover:opacity-80 transition-opacity"
              >
                Go to Provider Settings
              </button>
            </div>
          ) : (
            <div className="mt-1.5 w-full">
              <NativeSelect
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full h-11"
                required
              >
                {providers.map((prov) => (
                  <NativeSelectOption key={prov._id || prov.id} value={prov._id || prov.id}>
                    {prov.label} ({prov.defaultModel}){prov.isDefault ? " - Default" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          <FieldDescription className="text-xs">
            The API key of the selected provider is used to generate embeddings (vectors) for files you upload.
          </FieldDescription>
        </Field>

        {/* Advanced Config Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition-opacity"
          >
            <Sliders className="size-4" />
            {showAdvanced ? "Hide Advanced Vector Settings" : "Configure Custom Vector Settings (Optional)"}
          </button>
        </div>

        {/* Advanced Config Fields */}
        {showAdvanced && (
          <div className="space-y-6 p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30">
            {/* Embedding Model */}
            <Field>
              <FieldLabel className="text-sm font-bold">Embedding Model</FieldLabel>
              <div className="mt-1.5 w-full">
                <NativeSelect
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="text-embedding-3-small">
                    text-embedding-3-small (1536 dim - Recommended)
                  </NativeSelectOption>
                  <NativeSelectOption value="text-embedding-3-large">
                    text-embedding-3-large (3072 dim)
                  </NativeSelectOption>
                  <NativeSelectOption value="text-embedding-ada-002">
                    text-embedding-ada-002 (1536 dim)
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <FieldDescription className="text-xs">
                The model used to convert your text into vector embeddings.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              {/* Chunk Size */}
              <Field>
                <FieldLabel className="text-sm font-bold">Chunk Size</FieldLabel>
                <Input
                  type="number"
                  placeholder="800"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  className="bg-muted/20"
                  min="1"
                />
                <FieldDescription className="text-[11px] leading-tight">
                  Size of document text chunks.
                </FieldDescription>
              </Field>

              {/* Chunk Overlap */}
              <Field>
                <FieldLabel className="text-sm font-bold">Chunk Overlap</FieldLabel>
                <Input
                  type="number"
                  placeholder="100"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(e.target.value)}
                  className="bg-muted/20"
                  min="0"
                />
                <FieldDescription className="text-[11px] leading-tight">
                  Overlap characters between chunks.
                </FieldDescription>
              </Field>
            </div>

            {/* Top K */}
            <Field>
              <FieldLabel className="text-sm font-bold">Top K Results</FieldLabel>
              <Input
                type="number"
                placeholder="5"
                value={topK}
                onChange={(e) => setTopK(e.target.value)}
                className="bg-muted/20"
                min="1"
                max="50"
              />
              <FieldDescription className="text-xs">
                Number of relevant documents to retrieve on search.
              </FieldDescription>
            </Field>
          </div>
        )}

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
