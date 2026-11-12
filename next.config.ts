import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Follows the Appwrite region in .env (e.g. sgp.cloud.appwrite.io).
        hostname: new URL(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).hostname,
        port: "",
        pathname: "/v1/storage/**",
      },
    ],
  },
};

export default nextConfig;
