import { Newspaper, Building2, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPublicClient } from "@/lib/supabase/public-server";
import { formatRelativeDate } from "@/lib/format";
import { NewsCard, UpdateCard, EmptyState } from "@/components/news/news-card";
import { LaunchRadar } from "@/components/news/launch-radar";
import { SignalSummary } from "@/components/news/signal-summary";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import Link from "next/link";
import type { Metadata } from "next";
import {
  buildLaunchRadar,
  groupNewsBySignal,
  summarizeNewsSignals,
} from "@/lib/news/presentation";
import { buildModelNewsEvidenceMap } from "@/lib/news/evidence";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "News & Updates",
  description:
    "Latest AI model updates, research papers, benchmarks, and industry news.",
  openGraph: {
    title: "News & Updates",
    description:
      "Latest AI model updates, research papers, benchmarks, and industry news.",
    url: `${SITE_URL}/news`,
  },
  alternates: {
    canonical: `${SITE_URL}/news`,
  },
};

export const revalidate = 300;

export default async function NewsPage() {
  const supabase = createPublicClient();
  // eslint-disable-next-line react-hooks/purity -- server component snapshots a single time window per response
  const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const NEWS_FIELDS =
    "id, title, summary, url, source, category, related_provider, related_model_ids, tags, metadata, published_at";

  // Run all queries in parallel for speed
  const [
    updatesRes,
    twitterRes,
    blogsRes,
    deploymentsRes,
    papersRes,
    benchmarksRes,
    totalRes,
    byProviderRes,
    byModelNewsRes,
  ] = await Promise.all([
    // Model updates (internal changelog)
    supabase
      .from("model_updates")
      .select("*, models(slug, name, provider)")
      .order("published_at", { ascending: false })
      .limit(20),
    // X/Twitter posts
    supabase
      .from("model_news")
      .select(NEWS_FIELDS)
      .eq("source", "x-twitter")
      .order("published_at", { ascending: false })
      .limit(15),
    // Provider blog posts
    supabase
      .from("model_news")
      .select(NEWS_FIELDS)
      .eq("source", "provider-blog")
      .order("published_at", { ascending: false })
      .limit(15),
    // Deployment/self-host signals
    supabase
      .from("model_news")
      .select(NEWS_FIELDS)
      .in("source", ["provider-deployment-signals", "ollama-library"])
      .order("published_at", { ascending: false })
      .limit(25),
    // Research papers
    supabase
      .from("model_news")
      .select(NEWS_FIELDS)
      .in("source", ["arxiv", "hf-papers"])
      .order("published_at", { ascending: false })
      .limit(25),
    // Benchmarks
    supabase
      .from("model_news")
      .select(NEWS_FIELDS)
      .in("source", ["artificial-analysis", "open-llm-leaderboard"])
      .order("published_at", { ascending: false })
      .limit(25),
    // Count for badge
    supabase.from("model_news").select("id", { count: "exact", head: true }),
    // By Provider: group news by related_provider (latest 5 per provider)
    supabase
      .from("model_news")
      .select("id, title, url, source, related_provider, published_at")
      .not("related_provider", "is", null)
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("model_news")
      .select("related_model_ids, source, category, metadata")
      .gte("published_at", ninetyDaysAgoIso)
      .not("related_model_ids", "is", null)
      .order("published_at", { ascending: false })
      .limit(1000),
  ]);

  const updates = (updatesRes.data ?? []) as Record<string, unknown>[];
  const social = [
    ...((twitterRes.data ?? []) as Record<string, unknown>[]),
    ...((blogsRes.data ?? []) as Record<string, unknown>[]),
  ].sort(
    (a, b) =>
      new Date(b.published_at as string).getTime() -
      new Date(a.published_at as string).getTime()
  );
  const deployments = (deploymentsRes.data ?? []) as Record<string, unknown>[];
  const papers = (papersRes.data ?? []) as Record<string, unknown>[];
  const benchmarks = (benchmarksRes.data ?? []) as Record<string, unknown>[];
  const totalNewsCount = (totalRes.count as number) ?? 0;
  const totalItems = updates.length + totalNewsCount;
  const signalNews = [...social, ...deployments, ...papers, ...benchmarks];
  const signalSummary = summarizeNewsSignals(signalNews);
  const radarItems = buildLaunchRadar(signalNews, 8);
  const latestPublishedAt =
    [...updates, ...signalNews]
      .map((item) => (typeof item.published_at === "string" ? item.published_at : null))
      .find((value) => Boolean(value)) ?? null;
  const groupedSignals = groupNewsBySignal(signalNews).filter(
    (group) => group.type !== "general"
  );

  // Group news by provider for "By Provider" view
  const byProviderItems = (byProviderRes.data ?? []) as Record<string, unknown>[];
  const providerGroups = new Map<string, Record<string, unknown>[]>();
  for (const item of byProviderItems) {
    const prov = item.related_provider as string;
    if (!prov) continue;
    if (!providerGroups.has(prov)) providerGroups.set(prov, []);
    const group = providerGroups.get(prov)!;
    if (group.length < 5) group.push(item);
  }
  // Sort providers by most items
  const sortedProviders = [...providerGroups.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  const coverageMap = buildModelNewsEvidenceMap(
    ((byModelNewsRes.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      related_model_ids: Array.isArray(item.related_model_ids)
        ? (item.related_model_ids as string[])
        : null,
      source: typeof item.source === "string" ? item.source : null,
      category: typeof item.category === "string" ? item.category : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
    }))
  );
  const discussedIds = [...coverageMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 30)
    .map(([modelId]) => modelId);
  const { data: discussedModelRows } =
    discussedIds.length > 0
      ? await supabase
          .from("models")
          .select("id, slug, name, provider, quality_score")
          .eq("status", "active")
          .in("id", discussedIds)
      : { data: [] };
  const discussedById = new Map((discussedModelRows ?? []).map((model) => [model.id, model]));
  const discussedModels = discussedIds
    .map((modelId) => {
      const model = discussedById.get(modelId);
      if (!model) return null;
      return {
        model_id: model.id,
        model_slug: model.slug,
        model_name: model.name,
        model_provider: model.provider,
        quality_score: model.quality_score,
        coverage_score: coverageMap.get(modelId) ?? 0,
      };
    })
    .filter((model): model is NonNullable<typeof model> => Boolean(model));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Newspaper className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">News & Updates</h1>
        <Badge variant="secondary" className="ml-2 text-xs">
          {totalItems} items
        </Badge>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Start here for launches, deployability updates, pricing moves, benchmark updates, research, and provider posts in one stream.
      </p>

      <div className="mb-6">
        <DataFreshnessBadge
          label="News stream refreshed"
          timestamp={latestPublishedAt}
          detail="live signals"
        />
      </div>

      <div className="space-y-6 mb-8">
        <SignalSummary buckets={signalSummary} emptyLabel="No structured news signals have synced yet." />
        <LaunchRadar
          items={radarItems}
          title="Signal Radar"
          description="The highest-impact launch, pricing, benchmark, and API updates from official sources and synced research streams."
        />
      </div>

      <div className="mb-8 rounded-xl border border-border/50 bg-secondary/15 p-4 text-sm text-muted-foreground">
        Use <span className="font-medium text-foreground">Signals</span> for the quickest summary,
        <span className="font-medium text-foreground"> Deployments</span> for new self-host and runtime paths,
        <span className="font-medium text-foreground"> Social</span> for provider posts,
        <span className="font-medium text-foreground"> Research</span> for papers,
        and <span className="font-medium text-foreground"> Benchmarks</span> for leaderboard-related updates.
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="social">
            Social{social.length > 0 ? ` (${social.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="deployments">
            Deployments{deployments.length > 0 ? ` (${deployments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="updates">
            Model Updates
            {updates.length > 0 ? ` (${updates.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="research">
            Research{papers.length > 0 ? ` (${papers.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="benchmarks">
            Benchmarks
            {benchmarks.length > 0 ? ` (${benchmarks.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="by-provider">
            <Building2 className="h-3.5 w-3.5 mr-1" />
            By Provider
          </TabsTrigger>
          <TabsTrigger value="by-model">
            <Cpu className="h-3.5 w-3.5 mr-1" />
            By Model
          </TabsTrigger>
        </TabsList>

        {/* All tab — merged and sorted; limit benchmarks to top 5 linked ones */}
        <TabsContent value="all">
          <NewsStream
            updates={updates}
            news={[
              ...social,
              ...deployments,
              ...papers,
              ...benchmarks
                .filter((b) => {
                  const ids = b.related_model_ids as string[] | null;
                  return ids && ids.length > 0;
                })
                .slice(0, 5),
            ]}
          />
        </TabsContent>

        <TabsContent value="signals">
          {groupedSignals.length > 0 ? (
            <div className="space-y-8">
              {groupedSignals.map((group) => (
                <section key={group.type}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      {group.label}
                    </h2>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.items.length}
                    </Badge>
                  </div>
                    <div className="space-y-4">
                      {group.items.map((item) => (
                        <NewsCard
                          key={item.id}
                          item={item as unknown as Record<string, unknown>}
                        />
                      ))}
                    </div>
                  </section>
              ))}
            </div>
          ) : (
            <EmptyState message="No structured signals yet. Launch, pricing, benchmark, and API updates will appear here as they sync." />
          )}
        </TabsContent>

        {/* Social tab — X/Twitter + provider blogs */}
        <TabsContent value="social">
          {social.length > 0 ? (
            <div className="space-y-4">
              {social.map((item) => (
                <NewsCard key={item.id as string} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState message="No social posts yet. Twitter feeds sync daily via RSSHub." />
          )}
        </TabsContent>

        <TabsContent value="deployments">
          {deployments.length > 0 ? (
            <div className="space-y-4">
              {deployments.map((item) => (
                <NewsCard key={item.id as string} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState message="No usage updates yet. New self-host and official runtime paths will appear here as they sync." />
          )}
        </TabsContent>

        {/* Model Updates tab */}
        <TabsContent value="updates">
          {updates.length > 0 ? (
            <div className="space-y-4">
              {updates.map((update) => (
                <UpdateCard
                  key={update.id as string}
                  update={update}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No model updates yet." />
          )}
        </TabsContent>

        {/* Research tab */}
        <TabsContent value="research">
          {papers.length > 0 ? (
            <div className="space-y-4">
              {papers.map((item) => (
                <NewsCard key={item.id as string} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState message="No research papers yet. Papers sync daily from arXiv and HuggingFace." />
          )}
        </TabsContent>

        {/* Benchmarks tab */}
        <TabsContent value="benchmarks">
          {benchmarks.length > 0 ? (
            <div className="space-y-4">
              {benchmarks.map((item) => (
                <NewsCard key={item.id as string} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState message="No benchmark updates yet. Benchmarks sync periodically." />
          )}
        </TabsContent>

        {/* By Provider tab */}
        <TabsContent value="by-provider">
          {sortedProviders.length > 0 ? (
            <div className="space-y-6">
              {sortedProviders.map(([provider, items]) => (
                <Card key={provider} className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-neon" />
                      {provider}
                      <Badge variant="secondary" className="text-[11px] ml-1">
                        {items.length} recent
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id as string}
                          className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.title as string}
                      </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                {item.source as string}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                {formatRelativeDate(
                                  item.published_at as string
                                )}
                              </span>
                            </div>
                          </div>
                          {(item.url as string) && (
                            <a
                              href={item.url as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-neon hover:underline shrink-0"
                            >
                              View →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState message="No provider-linked news yet. Run backfill to link news to providers." />
          )}
        </TabsContent>

        {/* By Model tab */}
        <TabsContent value="by-model">
          {discussedModels.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Weighted coverage favors official provider posts, benchmarks, and research. Raw X
                volume is capped so social bursts do not overpower stronger evidence.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discussedModels.map((m) => (
                <Link
                  key={m.model_id}
                  href={`/models/${m.model_slug}`}
                  className="block"
                >
                  <Card className="border-border/50 hover:border-neon/30 transition-colors h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold truncate">
                          {m.model_name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="text-[11px] shrink-0 ml-2"
                        >
                          Coverage {Number(m.coverage_score).toFixed(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.model_provider}
                      </p>
                      {m.quality_score && (
                        <div className="mt-2 flex items-center gap-1">
                          <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-neon"
                              style={{
                                width: `${Number(m.quality_score)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-medium tabular-nums w-8 text-right">
                            {Number(m.quality_score).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
              </div>
            </div>
          ) : (
            <EmptyState message="No model-linked news yet. Run backfill to link news to models." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --- Subcomponents --- */

function NewsStream({
  updates,
  news,
}: {
  updates: Record<string, unknown>[];
  news: Record<string, unknown>[];
}) {
  type MergedItem =
    | { type: "update"; data: Record<string, unknown>; date: string }
    | { type: "news"; data: Record<string, unknown>; date: string };

  const merged: MergedItem[] = [
    ...updates.map((u) => ({
      type: "update" as const,
      data: u,
      date: (u.published_at as string) || (u.created_at as string) || "",
    })),
    ...news.map((n) => ({
      type: "news" as const,
      data: n,
      date: (n.published_at as string) || (n.created_at as string) || "",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (merged.length === 0) {
    return <EmptyState message="No updates yet. Check back soon!" />;
  }

  return (
    <div className="space-y-4">
      {merged.slice(0, 30).map((item, i) =>
        item.type === "update" ? (
          <UpdateCard key={`u-${i}`} update={item.data} />
        ) : (
          <NewsCard key={`n-${i}`} item={item.data} />
        )
      )}
    </div>
  );
}
