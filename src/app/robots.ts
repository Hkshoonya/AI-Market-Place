import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/activity",
          "/deployments",
          "/workspace",
          "/wallet",
          "/orders",
          "/watchlists",
          "/profile",
          "/settings/",
          "/start",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
