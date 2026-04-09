import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.secret (gitignored) for server-only API keys
const secretPath = resolve(process.cwd(), ".env.secret");
if (existsSync(secretPath)) {
  const content = readFileSync(secretPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
