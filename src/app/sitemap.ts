import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/constants/categories";
import { SITE_URL } from "@/lib/constants/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/models`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/leaderboards`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/providers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/news`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/api-docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/discover`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
  ];

  // Category pages
  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/models?category=${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Leaderboard category pages
  const leaderboardRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/leaderboards/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Model detail pages
  const { data: modelsRaw } = await supabase
    .from("models")
    .select("slug, updated_at")
    .eq("status", "active")
    .order("overall_rank", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRoutes: MetadataRoute.Sitemap = ((modelsRaw as any[]) ?? []).map((m) => ({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listingRoutes: MetadataRoute.Sitemap = ((listingsRaw as any[]) ?? []).map((l) => ({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueProviders = [...new Set(((providerRowsRaw as any[]) ?? []).map((p: any) => p.provider))];
  const providerRoutes: MetadataRoute.Sitemap = uniqueProviders.map((p) => ({
    url: `${SITE_URL}/providers/${encodeURIComponent(p.toLowerCase().replace(/\s+/g, "-"))}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...leaderboardRoutes,
    ...modelRoutes,
    ...listingRoutes,
    ...providerRoutes,
  ];
}
