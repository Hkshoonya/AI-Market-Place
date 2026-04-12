import type { MetadataRoute } from "next";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";
import { CATEGORIES } from "@/lib/constants/categories";
import { SITE_URL } from "@/lib/constants/site";
import { getProviderSlug } from "@/lib/constants/providers";
import type { Database } from "@/types/database";

type PublicSupabaseClient = NonNullable<ReturnType<typeof createOptionalPublicClient>>;
type Awaitable<T> = T | PromiseLike<T>;

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ModelTimestampRow = Pick<Database["public"]["Tables"]["models"]["Row"], "updated_at">;
type ModelSitemapRow = Pick<Database["public"]["Tables"]["models"]["Row"], "slug" | "updated_at">;
type ListingTimestampRow = Pick<
  Database["public"]["Tables"]["marketplace_listings"]["Row"],
  "updated_at"
>;
type ListingSitemapRow = Pick<
  Database["public"]["Tables"]["marketplace_listings"]["Row"],
  "slug" | "updated_at"
>;
type ProviderSitemapRow = Pick<Database["public"]["Tables"]["models"]["Row"], "provider">;
type NewsSitemapRow = Pick<Database["public"]["Tables"]["model_news"]["Row"], "published_at">;

function buildStaticRoutes(lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/models`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/leaderboards`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/marketplace/browse`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/marketplace/auctions`, lastModified, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/sell`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/compare`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/providers`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/roadmap`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/news`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/commons`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/api-docs`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/discover`, lastModified, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/skills`, lastModified, changeFrequency: "daily", priority: 0.6 },
  ];
}

async function safeQuery<T>(
  operation: () => Awaitable<QueryResult<T>>
): Promise<T[]> {
  try {
    const { data, error } = await operation();
    if (error) {
      console.error("sitemap query failed", error.message);
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.error("sitemap query threw", error);
    return [];
  }
}

function toLastModified(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function loadDynamicRoutes(
  supabase: PublicSupabaseClient,
  fallbackDate: Date
): Promise<MetadataRoute.Sitemap> {
  const [latestModels, latestListings, latestNews, models, listings, providerRows] =
    await Promise.all([
      safeQuery<ModelTimestampRow>(() =>
        supabase
          .from("models")
          .select("updated_at")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
      ),
      safeQuery<ListingTimestampRow>(() =>
        supabase
          .from("marketplace_listings")
          .select("updated_at")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
      ),
      safeQuery<NewsSitemapRow>(() =>
        supabase
          .from("model_news")
          .select("published_at")
          .order("published_at", { ascending: false })
          .limit(1)
      ),
      safeQuery<ModelSitemapRow>(() =>
        supabase
          .from("models")
          .select("slug, updated_at")
          .eq("status", "active")
          .order("overall_rank", { ascending: true })
      ),
      safeQuery<ListingSitemapRow>(() =>
        supabase
          .from("marketplace_listings")
          .select("slug, updated_at")
          .eq("status", "active")
      ),
      safeQuery<ProviderSitemapRow>(() =>
        supabase
          .from("models")
          .select("provider")
          .eq("status", "active")
      ),
    ]);

  const latestModelModified = toLastModified(latestModels[0]?.updated_at, fallbackDate);
  const latestListingModified = toLastModified(
    latestListings[0]?.updated_at,
    latestModelModified
  );
  const latestNewsModified = toLastModified(
    latestNews[0]?.published_at,
    latestModelModified
  );

  const staticRoutes = buildStaticRoutes(latestModelModified).map((route) => {
    if (route.url === `${SITE_URL}/marketplace`) {
      return { ...route, lastModified: latestListingModified };
    }
    if (route.url === `${SITE_URL}/marketplace/browse`) {
      return { ...route, lastModified: latestListingModified };
    }
    if (route.url === `${SITE_URL}/marketplace/auctions`) {
      return { ...route, lastModified: latestListingModified };
    }
    if (route.url === `${SITE_URL}/sell`) {
      return { ...route, lastModified: latestListingModified };
    }
    if (route.url === `${SITE_URL}/news`) {
      return { ...route, lastModified: latestNewsModified };
    }
    if (route.url === `${SITE_URL}/commons`) {
      return { ...route, lastModified: latestNewsModified };
    }
    return route;
  });

  const leaderboardRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/leaderboards/${cat.slug}`,
    lastModified: latestModelModified,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const modelRoutes: MetadataRoute.Sitemap = models
    .filter((model) => typeof model.slug === "string" && model.slug.length > 0)
    .map((model) => ({
      url: `${SITE_URL}/models/${model.slug}`,
      lastModified: toLastModified(model.updated_at, latestModelModified),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const listingRoutes: MetadataRoute.Sitemap = listings
    .filter((listing) => typeof listing.slug === "string" && listing.slug.length > 0)
    .map((listing) => ({
      url: `${SITE_URL}/marketplace/${listing.slug}`,
      lastModified: toLastModified(listing.updated_at, latestListingModified),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  const providerRoutes: MetadataRoute.Sitemap = [...new Set(
    providerRows
      .map((row) => row.provider)
      .filter((provider): provider is string => typeof provider === "string" && provider.length > 0)
      .map((provider) => getProviderSlug(provider))
      .filter(Boolean)
  )].map((providerSlug) => ({
    url: `${SITE_URL}/providers/${providerSlug}`,
    lastModified: latestModelModified,
    changeFrequency: "weekly",
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallbackDate = new Date();
  const supabase = createOptionalPublicClient();

  if (!supabase) {
    return buildStaticRoutes(fallbackDate);
  }

  const routes = await loadDynamicRoutes(supabase, fallbackDate);
  return routes.length > 0 ? routes : buildStaticRoutes(fallbackDate);
}
