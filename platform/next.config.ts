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
    // NEXT_PUBLIC_API_URL is meant to be settable either as a plain base URL
    // (http://localhost:3001/api/v1) or the full rewrite target with :path*
    // already appended — normalize to the latter here instead of assuming
    // callers remember the suffix. Skipping it silently breaks every request
    // through this rewrite: Next.js appends the unconsumed :path* segments
    // as repeated ?path= query params on the destination instead of real
    // path segments (this bit local dev exactly this way — a plain base URL
    // in .env, no /:path* suffix — every proxied call 404'd against agent-backend).
    const rawApiUrl =
      process.env.NEXT_PUBLIC_API_URL || "https://api.persona.hasanraiyan.me/api/v1";
    const apiDestination = rawApiUrl.includes(":path*")
      ? rawApiUrl
      : `${rawApiUrl.replace(/\/$/, "")}/:path*`;

    return [
      {
        source: "/api/v1/:path*",
        // Mirrors frontend/next.config.mjs exactly — same admin API, same
        // proxy shape.
        destination: apiDestination,
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
