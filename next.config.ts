import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce a minimal standalone server bundle for Docker deployment.
  output: "standalone",
  images: {
    // Allowlist only the hosts we actually load images from — avatars (Telegram/Google) and
    // our R2 public bucket — so the /_next/image optimizer can't be used to fetch arbitrary
    // external URLs (SSRF/bandwidth abuse). R2 host is derived from S3_PUBLIC_BASE_URL.
    remotePatterns: [
      { protocol: "https", hostname: "t.me" },
      { protocol: "https", hostname: "*.telegram.org" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      ...(() => {
        try {
          const h = new URL(process.env.S3_PUBLIC_BASE_URL ?? "").hostname;
          return h ? [{ protocol: "https" as const, hostname: h }] : [];
        } catch {
          return [];
        }
      })(),
    ],
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
      // Enforced now — verified to have no external deps: SSE/API are same-origin (connect),
      // the app embeds no iframes (frame; login is a Telegram deeplink, not a widget), and
      // there are no external/web fonts (font). img/script/style stay Report-Only (the
      // R2/Telegram image allowlist + Next's script nonce are the attended next step).
      // Clarity beacons upload session data to *.clarity.ms + c.bing.com (Microsoft's
      // collector); the Meta Pixel beacons to www.facebook.com — required or
      // analytics silently drops every payload.
      "connect-src 'self' https://*.clarity.ms https://c.bing.com https://www.facebook.com",
      "frame-src 'self'",
      "font-src 'self' data:",
    ].join("; ");
    // Report-Only "discovery" policy: actionable directives (img/connect/frame/font) are
    // tightened to 'self' so the browser REPORTS every external resource the app loads
    // (covers from R2, the Telegram login widget iframe, etc.) without blocking anything.
    // script/style stay loose because Report-Only can't apply Next's per-request nonce, so
    // tightening them would only produce false positives. Violations POST to /api/csp-report.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.clarity.ms https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://www.facebook.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clarity.ms https://c.bing.com https://www.facebook.com",
      "frame-src 'self'",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
      "base-uri 'self'",
      "object-src 'none'",
      "report-uri /api/csp-report",
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
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
