import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Security Headers */
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
      ],
    },
  ],

  /* Performance */
  compress: true,
  poweredByHeader: false,

  /* Image Optimization */
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
