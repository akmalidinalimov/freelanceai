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
      // Enforced now — verified to have no external deps: SSE/API are same-origin (connect),
      // the app embeds no iframes (frame; login is a Telegram deeplink, not a widget), and
      // there are no external/web fonts (font). img/script/style stay Report-Only (the
      // R2/Telegram image allowlist + Next's script nonce are the attended next step).
      "connect-src 'self'",
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
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
