import {
  CpuIcon,
  WrenchIcon,
  DatabaseIcon,
  PlugZapIcon,
  SparklesIcon,
} from "lucide-react";

const pieces = [
  {
    icon: CpuIcon,
    title: "A provider you choose",
    description: "OpenAI, Anthropic, Gemini, or DeepSeek — your own key.",
  },
  {
    icon: WrenchIcon,
    title: "Skills",
    description: "Reusable capabilities you attach instead of rebuild.",
  },
  {
    icon: DatabaseIcon,
    title: "Knowledge",
    description: "Upload documents; the mind retrieves from them (RAG).",
  },
  {
    icon: PlugZapIcon,
    title: "Connectors",
    description: "MCP servers that give the mind real tools to call.",
  },
  {
    icon: SparklesIcon,
    title: "The Architect",
    description: "A co-pilot that writes the system prompt with you, in chat.",
  },
];

export function BuiltFromSection() {
  return (
    <section className="relative bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col items-start gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
            Inside Agent Studio
          </span>
          <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            What a mind is built from.
          </h2>
          <p className="max-w-xl text-base text-zinc-500">
            No fixed template — every agent in Studio is assembled from the same
            five real pieces.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-5">
          {pieces.map((piece) => (
            <div key={piece.title} className="flex flex-col gap-3 bg-white p-6">
              <piece.icon className="size-5 text-[#1E60FF]" />
              <p className="text-sm font-semibold text-zinc-900">
                {piece.title}
              </p>
              <p className="text-sm leading-relaxed text-zinc-500">
                {piece.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
