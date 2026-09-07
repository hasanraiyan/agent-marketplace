import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
