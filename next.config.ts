import type { NextConfig } from "next";

// Extra hosts that may open the dev server, e.g. a phone on the LAN:
// ALLOWED_DEV_ORIGINS=192.168.1.20,100.64.0.5 npm run dev
const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),
  poweredByHeader: false,
};

export default nextConfig;
