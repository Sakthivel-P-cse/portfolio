import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @prisma/client and pg are auto-excluded by Next.js.
  // @prisma/adapter-pg is not in the auto-list, so opt it out explicitly.
  serverExternalPackages: ["@prisma/adapter-pg"],
};

export default nextConfig;
