import type { MetadataRoute } from "next";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://platform.persona.hasanraiyan.me").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/concepts", "/r/"],
        disallow: ["/projects", "/api/", "/_next/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
