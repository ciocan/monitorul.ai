import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  allowedDevOrigins: ["192.168.1.177"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
