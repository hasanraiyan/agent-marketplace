import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocMeta { title: string; description?: string; sdk: string; version: string; slug: string[]; prev?: string; next?: string; related?: string[]; }

export function listDocs(sdk: string, version: string): string[] {
  const dir = path.join(process.cwd(), "content/docs", sdk, `v${version}`);
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  function walk(cur: string, prefix: string[]) {
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) walk(p, [...prefix, e.name]);
      else if (e.name.endsWith(".mdx")) {
        const slug = [...prefix, e.name.replace(/\.mdx$/, "")];
        if (slug[slug.length-1]==="index") slug.pop();
        out.push(slug.join("/") || "");
      }
    }
  }
  walk(dir, []);
  return out;
}

export function readDoc(sdk: string, version: string, slug: string[]): { meta: DocMeta; content: string } | null {
  const base = path.join(process.cwd(), "content/docs", sdk, `v${version}`);
  const tryPaths = [
    path.join(base, ...slug) + ".mdx",
    path.join(base, ...slug, "index.mdx"),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const { data, content } = matter(raw);
      return { meta: { sdk, version, slug, title: data.title ?? slug[slug.length-1] ?? "Docs", ...data } as DocMeta, content };
    }
  }
  return null;
}
