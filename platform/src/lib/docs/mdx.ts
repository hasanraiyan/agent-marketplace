import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocMeta {
  title: string;
  description?: string;
  sdk: string;
  version: string;
  slug: string[];
  prev?: string;
  next?: string;
  related?: string[];
}

export interface DocsNavItem {
  title: string;
  description?: string;
  href: string;
  slug: string[];
  isIndex?: boolean;
}

export interface DocsNavGroup {
  name: string;
  folder?: string;
  items: DocsNavItem[];
}

export interface DocsNavigation {
  groups: DocsNavGroup[];
  flatItems: DocsNavItem[];
}

const DOCS_BASE = path.join(process.cwd(), "content", "docs");

export function listDocs(sdk: string, version: string): string[] {
  const dir = path.join(DOCS_BASE, sdk, `v${version}`);
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  function walk(cur: string, prefix: string[]) {
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) walk(p, [...prefix, e.name]);
      else if (e.name.endsWith(".mdx")) {
        const slug = [...prefix, e.name.replace(/\.mdx$/, "")];
        if (slug[slug.length - 1] === "index") slug.pop();
        out.push(slug.join("/") || "");
      }
    }
  }
  walk(dir, []);
  return out;
}

export function readDoc(
  sdk: string,
  version: string,
  slug: string[]
): { meta: DocMeta; content: string } | null {
  const base = path.join(DOCS_BASE, sdk, `v${version}`);
  const tryPaths = [
    path.join(base, ...slug) + ".mdx",
    path.join(base, ...slug, "index.mdx"),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const { data, content } = matter(raw);
      return {
        meta: {
          sdk,
          version,
          slug,
          title: data.title ?? slug[slug.length - 1] ?? "Docs",
          ...data,
        } as DocMeta,
        content,
      };
    }
  }
  return null;
}

function formatTitleFromFilename(name: string): string {
  return name
    .replace(/\.mdx$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatGroupName(folder: string): string {
  const map: Record<string, string> = {
    guides: "Guides",
    resources: "API Resources",
    routes: "Routes & Endpoints",
    hooks: "Hooks Reference",
  };
  return (
    map[folder.toLowerCase()] ??
    folder.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getDocsNavigation(sdk: string, version: string): DocsNavigation {
  const baseDir = path.join(DOCS_BASE, sdk, `v${version}`);
  if (!fs.existsSync(baseDir)) {
    return { groups: [], flatItems: [] };
  }

  const rootItems: DocsNavItem[] = [];
  const folderGroups: Record<string, DocsNavItem[]> = {};

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  // 1. Process root items
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      const subDir = path.join(baseDir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      folderGroups[entry.name] = [];

      for (const subEntry of subEntries) {
        if (!subEntry.name.endsWith(".mdx") || subEntry.name.startsWith(".")) continue;

        const filePath = path.join(subDir, subEntry.name);
        let title = formatTitleFromFilename(subEntry.name);
        let description: string | undefined;

        try {
          const raw = fs.readFileSync(filePath, "utf8");
          const { data } = matter(raw);
          if (data.title) title = data.title;
          if (data.description) description = data.description;
        } catch {}

        const isSubIndex = subEntry.name === "index.mdx";
        const fileSlug = subEntry.name.replace(/\.mdx$/, "");
        const slug = isSubIndex ? [entry.name] : [entry.name, fileSlug];
        const href = `/docs/${sdk}/v${version}/${slug.join("/")}`;

        folderGroups[entry.name].push({
          title,
          description,
          href,
          slug,
          isIndex: isSubIndex,
        });
      }

      // Sort items inside folder: index first, then alphabetical
      folderGroups[entry.name].sort((a, b) => {
        if (a.isIndex) return -1;
        if (b.isIndex) return 1;
        return a.title.localeCompare(b.title);
      });
    } else if (entry.name.endsWith(".mdx")) {
      const filePath = path.join(baseDir, entry.name);
      let title = formatTitleFromFilename(entry.name);
      let description: string | undefined;

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const { data } = matter(raw);
        if (data.title) title = data.title;
        if (data.description) description = data.description;
      } catch {}

      const isIndex = entry.name === "index.mdx";
      const fileSlug = entry.name.replace(/\.mdx$/, "");
      const slug = isIndex ? [] : [fileSlug];
      const href = isIndex
        ? `/docs/${sdk}/v${version}`
        : `/docs/${sdk}/v${version}/${fileSlug}`;

      rootItems.push({
        title: isIndex ? "Overview" : title,
        description,
        href,
        slug,
        isIndex,
      });
    }
  }

  // Sort root items: index first, quickstart second, then alphabetical
  rootItems.sort((a, b) => {
    if (a.isIndex) return -1;
    if (b.isIndex) return 1;
    if (a.slug[0] === "quickstart") return -1;
    if (b.slug[0] === "quickstart") return 1;
    return a.title.localeCompare(b.title);
  });

  const groups: DocsNavGroup[] = [];

  if (rootItems.length > 0) {
    groups.push({
      name: "Getting Started",
      items: rootItems,
    });
  }

  // Pre-determined order for common folders
  const folderOrder = ["routes", "guides", "resources", "hooks"];
  const sortedFolders = Object.keys(folderGroups).sort((a, b) => {
    const idxA = folderOrder.indexOf(a.toLowerCase());
    const idxB = folderOrder.indexOf(b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const folder of sortedFolders) {
    const items = folderGroups[folder];
    if (items && items.length > 0) {
      groups.push({
        name: formatGroupName(folder),
        folder,
        items,
      });
    }
  }

  // Build flat items list for pagination (prev/next)
  const flatItems: DocsNavItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      flatItems.push(item);
    }
  }

  return { groups, flatItems };
}
