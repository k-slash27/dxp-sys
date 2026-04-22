import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: '/operator',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
