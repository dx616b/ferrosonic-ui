import type { NextConfig } from "next";

const exporting = process.env.FERROSONIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Prevent Next.js from regenerating AGENTS.md / CLAUDE.md in this repo.
  agentRules: false,
  // Static files are embedded into the ferrosonic-ui executable. The API
  // route is only for `next dev`; the binary serves /api/player itself.
  ...(exporting ? { output: "export" as const, images: { unoptimized: true } } : {}),
};

export default nextConfig;
