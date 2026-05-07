import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Validate env at config-load time so `next dev` / `next build` fail fast on
// missing or malformed vars rather than at the first request.
import "./src/env";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  allowedDevOrigins: ["192.168.1.177"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
