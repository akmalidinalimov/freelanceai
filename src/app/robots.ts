import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_ORIGIN ?? "https://gigora.ai").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/uz/dashboard", "/ru/dashboard", "/en/dashboard", "/uz/admin", "/ru/admin", "/en/admin"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
