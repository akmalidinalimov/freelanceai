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
  // Security headers. The CSP is intentionally scoped to clickjacking/injection directives
  // that do NOT constrain script/style/img loading: `frame-ancestors` (allowlisting the
  // Telegram Mini App while blocking all other embedders — this replaces X-Frame-Options,
  // which can't allowlist Telegram), plus `object-src`/`base-uri`. A full content CSP
  // (script-src/style-src/img-src) is a separate follow-up that must ship Report-Only first.
  async headers() {
    const csp = [
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
