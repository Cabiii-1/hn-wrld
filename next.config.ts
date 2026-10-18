import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["sharp", "music-metadata", "file-type"],
  async headers() {
    return [
      {
        source: "/game/backgrounds/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      ...[
        "/",
        "/play/:path*",
        "/admin/:path*",
        "/invite/:path*",
        "/contribute/:path*",
        "/api/manage/:path*",
      ].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
export default config;
