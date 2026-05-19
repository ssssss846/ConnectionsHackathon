import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "campus.hellorubric.com" },
      { protocol: "https", hostname: "resources.hellorubric.com" },
      { protocol: "https", hostname: "portal.getqpay.com" },
      { protocol: "https", hostname: "resources.getqpay.com" },
    ],
  },
};

export default nextConfig;
