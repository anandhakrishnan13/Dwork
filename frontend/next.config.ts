import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Load the single repository-root .env shared with the backend.
loadEnv({ path: new URL("../.env", import.meta.url), quiet: true });

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.NODE_ENV === "production"
        ? "/api"
        : "http://localhost:4000"),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
