import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  webpack: (config, { dev }) => {
    // PDF.js ESM fails under Webpack's eval-based development source maps.
    // Keep useful debugging information without using an eval-* devtool.
    if (dev) config.devtool = "cheap-module-source-map";
    return config;
  },
};

export default nextConfig;
