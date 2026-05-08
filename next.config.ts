import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Validate env at config-load time so `next dev` / `next build` fail fast on
// missing or malformed vars rather than at the first request.
import { env } from "./src/env";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  allowedDevOrigins: env.ALLOWED_DEV_ORIGINS,
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
