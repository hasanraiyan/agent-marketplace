import Link from "next/link";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export const metadata = {
  title: "Concepts — Persona Docs",
  description: "Shared concepts across all Persona SDKs — credentials, external users, AG-UI, pagination, errors.",
};

function listConcepts() {
  const base = path.join(process.cwd(), "content", "concepts");
  if (!fs.existsSync(base)) return [];
  const out: { slug: string; title: string; description?: string }[] = [];
  function walk(cur: string, prefix: string[]) {
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) walk(p, [...prefix, e.name]);
      else if (e.name.endsWith(".mdx") || e.name.endsWith(".md")) {
        const slug = [...prefix, e.name.replace(/\.mdx$/, "").replace(/\.md$/, "")].join("/");
        try {
          const raw = fs.readFileSync(p, "utf8");
          const { data } = matter(raw);
          out.push({ slug, title: data.title || slug, description: data.description });
        } catch {
          out.push({ slug, title: slug });
        }
      }
    }
  }
  walk(base, []);
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export default function ConceptsIndex() {
  const concepts = listConcepts();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Concepts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Version-agnostic guides shared across all SDKs — one place to learn credentials, external users, AG-UI, and more.
      </p>
      <div className="mt-8 grid gap-3">
        {concepts.map((c) => (
          <Link
            key={c.slug}
            href={`/concepts/${c.slug}`}
            className="rounded-lg border border-border p-4 hover:border-blue-600 hover:bg-accent/30"
          >
            <div className="text-sm font-semibold">{c.title}</div>
            {c.description && <div className="mt-1 text-xs text-muted-foreground">{c.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
