import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
};
export default nextConfig;