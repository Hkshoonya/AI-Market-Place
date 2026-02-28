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
          "/auth/",
          "/profile",
          "/watchlists",
          "/activity",
          "/dashboard/",
          "/sell",
          "/login",
          "/signup",
          "/settings/",
          "/notifications",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
