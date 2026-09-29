import type { NextConfig } from "next";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root: a package-lock.json in the home folder confuses detection.
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      // The staff portal and auth pages must never be framed. CSP lands in Phase 3 with Stripe.
      { source: "/restaurant/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/login", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
