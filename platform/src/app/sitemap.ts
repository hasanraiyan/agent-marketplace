import type { MetadataRoute } from "next";
import { getSdks } from "@/lib/docs/registry";
import { listDocs } from "@/lib/docs/mdx";
import fs from "fs";
import path from "path";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://platform.persona.hasanraiyan.me").replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [];

  // Core public pages
  urls.push({ url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 });
  urls.push({ url: `${base}/docs`, lastModified: now, changeFrequency: "daily", priority: 0.9 });

  // Concepts (version-agnostic)
  const conceptsBase = path.join(process.cwd(), "content", "concepts");
  if (fs.existsSync(/*turbopackIgnore: true*/ conceptsBase)) {
    function walkConcepts(cur: string, prefix: string[]) {
      for (const e of fs.readdirSync(/*turbopackIgnore: true*/ cur, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(cur, e.name);
        if (e.isDirectory()) walkConcepts(p, [...prefix, e.name]);
        else if (e.name.endsWith(".mdx") || e.name.endsWith(".md")) {
          const slug = [...prefix, e.name.replace(/\.mdx$/, "").replace(/\.md$/, "")].join("/");
          urls.push({
            url: `${base}/concepts/${slug}`,
            lastModified: fs.statSync(/*turbopackIgnore: true*/ p).mtime,
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
    walkConcepts(conceptsBase, []);
  }

  // Versioned docs — every SDK + version + slug
  for (const sdk of getSdks()) {
    for (const version of sdk.versions) {
      const slugs = listDocs(sdk.id, version);
      // SDK version index
      urls.push({
        url: `${base}/docs/${sdk.id}/v${version}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const slug of slugs) {
        const href = slug ? `/docs/${sdk.id}/v${version}/${slug}` : `/docs/${sdk.id}/v${version}`;
        // Use file mtime if available
        const tryPaths = [
          path.join(process.cwd(), "content", "docs", sdk.id, `v${version}`, slug + ".mdx"),
          path.join(process.cwd(), "content", "docs", sdk.id, `v${version}`, slug, "index.mdx"),
        ];
        let lastMod: Date | undefined;
        for (const p of tryPaths) if (fs.existsSync(/*turbopackIgnore: true*/ p)) { lastMod = fs.statSync(/*turbopackIgnore: true*/ p).mtime; break; }
        urls.push({
          url: `${base}${href}`,
          lastModified: lastMod ?? now,
          changeFrequency: "weekly",
          priority: slug ? 0.7 : 0.8,
        });
      }
      // Also expose /docs/{sdk} → latest redirect as canonical sitemap entry
      urls.push({
        url: `${base}/docs/${sdk.id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return urls;
}
