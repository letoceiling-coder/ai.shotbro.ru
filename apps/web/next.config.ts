import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const turbopackRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@shotbro/contracts", "@shotbro/agent-core"],
  images: {
    localPatterns: [{ pathname: "/demo-assets/**" }],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: turbopackRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
