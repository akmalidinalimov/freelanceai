import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce a minimal standalone server bundle for Docker deployment.
  output: "standalone",
  images: {
    // Allow Telegram profile photos and (later) our media CDN.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Conservative, non-breaking security headers. We intentionally omit X-Frame-Options and a
  // strict CSP: the Telegram Mini App + login widget and the R2 media domain make those
  // high-risk to apply blind — they're a tracked follow-up that needs visual verification.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
