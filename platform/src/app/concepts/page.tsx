import Link from "next/link";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
      <div className="space-y-3">
        <Badge variant="secondary" className="px-3 py-1 text-xs">
          Shared Concepts
        </Badge>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Concepts
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
          Version-agnostic guides shared across all SDKs — one place to learn credentials, external users, AG-UI, pagination, errors, and more.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {concepts.map((c) => (
          <Link key={c.slug} href={`/concepts/${c.slug}`} className="group block">
            <Card className="h-full transition-all hover:bg-muted/40 hover:ring-1 hover:ring-border">
              <CardHeader className="space-y-2 p-6">
                <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {c.title}
                </CardTitle>
                {c.description && (
                  <CardDescription className="text-xs leading-relaxed">
                    {c.description}
                  </CardDescription>
                )}
              </CardHeader>
              <Separator className="opacity-60" />
              <div className="px-6 py-3 text-xs font-mono text-muted-foreground">/concepts/{c.slug}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
