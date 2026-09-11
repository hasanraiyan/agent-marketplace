import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `readDoc()` (src/lib/docs/mdx.ts) reads `content/docs/**` via a
  // dynamic, unbounded-depth path (turbopackIgnore'd there since it defeats
  // file-trace analysis) — declare it explicitly so it still ships in the
  // deployed server output instead of relying on that analysis to find it.
  outputFileTracingIncludes: {
    "/docs/**": ["./content/docs/**/*"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        // Mirrors frontend/next.config.mjs exactly — same admin API, same
        // proxy shape, so NEXT_PUBLIC_API_URL means the same thing in both
        // apps (either unset, or the full rewrite target with :path*).
        destination:
          process.env.NEXT_PUBLIC_API_URL ||
          "https://api.persona.hasanraiyan.me/api/v1/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/r/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
