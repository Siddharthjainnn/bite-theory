import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver (pg) out of the bundler so it loads
  // normally at runtime. Without this you get "Cannot find module 'pg-types'".
  serverExternalPackages: ["pg"],
};
export default nextConfig;