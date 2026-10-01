import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from regenerating AGENTS.md / CLAUDE.md in this repo.
  agentRules: false,
};

export default nextConfig;
