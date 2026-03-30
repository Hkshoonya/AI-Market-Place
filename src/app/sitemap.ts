import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public-server";
import { CATEGORIES } from "@/lib/constants/categories";
import { SITE_URL } from "@/lib/constants/site";
import { getProviderSlug } from "@/lib/constants/providers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const [
    { data: latestModelRaw },
    { data: latestListingRaw },
    { data: latestNewsRaw },
  ] = await Promise.all([
    supabase
      .from("models")
      .select("updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("marketplace_listings")
      .select("updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("model_news")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1),
  ]);

  const latestModelModified = latestModelRaw?.[0]?.updated_at
    ? new Date(latestModelRaw[0].updated_at)
    : new Date();
  const latestListingModified = latestListingRaw?.[0]?.updated_at
    ? new Date(latestListingRaw[0].updated_at)
    : latestModelModified;
  const latestNewsModified = latestNewsRaw?.[0]?.published_at
    ? new Date(latestNewsRaw[0].published_at)
    : latestModelModified;

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: latestModelModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/models`, lastModified: latestModelModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/leaderboards`, lastModified: latestModelModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace`, lastModified: latestListingModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace/browse`, lastModified: latestListingModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/marketplace/auctions`, lastModified: latestListingModified, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/compare`, lastModified: latestModelModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/providers`, lastModified: latestModelModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: latestModelModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: latestModelModified, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: latestModelModified, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/news`, lastModified: latestNewsModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/commons`, lastModified: latestNewsModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: latestModelModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: latestModelModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/api-docs`, lastModified: latestModelModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/discover`, lastModified: latestModelModified, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/skills`, lastModified: latestModelModified, changeFrequency: "daily", priority: 0.6 },
  ];

  // Leaderboard category pages
  const leaderboardRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/leaderboards/${cat.slug}`,
    lastModified: latestModelModified,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Model detail pages
  const { data: modelsRaw } = await supabase
    .from("models")
    .select("slug, updated_at")
    .eq("status", "active")
    .order("overall_rank", { ascending: true });

  const modelRoutes: MetadataRoute.Sitemap = (modelsRaw ?? []).map((m) => ({
    url: `${SITE_URL}/models/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Marketplace listing pages
  const { data: listingsRaw } = await supabase
    .from("marketplace_listings")
    .select("slug, updated_at")
    .eq("status", "active");

  const listingRoutes: MetadataRoute.Sitemap = (listingsRaw ?? []).map((l) => ({
    url: `${SITE_URL}/marketplace/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Provider pages
  const { data: providerRowsRaw } = await supabase
    .from("models")
    .select("provider")
    .eq("status", "active");

  const uniqueProviders = [...new Set((providerRowsRaw ?? []).map((p) => p.provider))];
  const providerRoutes: MetadataRoute.Sitemap = uniqueProviders.map((p) => ({
    url: `${SITE_URL}/providers/${getProviderSlug(p)}`,
    lastModified: latestModelModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...leaderboardRoutes,
    ...modelRoutes,
    ...listingRoutes,
    ...providerRoutes,
  ];
}
