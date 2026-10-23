import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/**/*"],
  },
};

export default nextConfig;
