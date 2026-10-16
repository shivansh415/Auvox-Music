import type { NextConfig } from "next";
import { SHOWCASE, UNFINISHED_ROUTES } from "./src/lib/showcase";

const nextConfig: NextConfig = {
  // the client preview build only shows the finished pages (see src/lib/showcase.ts)
  async redirects() {
    if (!SHOWCASE) return [];
    return UNFINISHED_ROUTES.flatMap((r) => [
      { source: r, destination: "/coming-soon", permanent: false },
      { source: `${r}/:path*`, destination: "/coming-soon", permanent: false },
    ]);
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
