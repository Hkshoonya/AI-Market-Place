import { Newspaper, FlaskConical, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDate } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "News & Updates",
  description:
    "Latest AI model updates, research papers, benchmarks, and industry news.",
};

export const revalidate = 1800;

export default async function NewsPage() {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch model updates (internal changelog)
  const { data: updatesRaw } = await sb
    .from("model_updates")
    .select("*, models(slug, name, provider)")
    .order("published_at", { ascending: false })
    .limit(50);

  const updates = (updatesRaw ?? []) as Record<string, unknown>[];

  // Fetch research papers and news from data adapters
  const { data: newsRaw } = await sb
    .from("model_news")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(100);

  const allNews = (newsRaw ?? []) as Record<string, unknown>[];

  // Split news by category
  const papers = allNews.filter(
    (n) =>
      n.source === "arxiv" ||
      n.source === "hf-papers" ||
      n.category === "research" ||
      n.category === "nlp" ||
      n.category === "vision" ||
      n.category === "ai" ||
      n.category === "ml"
  );

  const benchmarks = allNews.filter(
    (n) =>
      n.source === "artificial-analysis" ||
      n.source === "open-llm-leaderboard" ||
      n.category === "benchmark"
  );

  const totalItems = updates.length + allNews.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Newspaper className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">News & Updates</h1>
        <Badge variant="secondary" className="ml-2 text-xs">
          {totalItems} items
        </Badge>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="updates">
            Model Updates{updates.length > 0 ? ` (${updates.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="research">
            Research{papers.length > 0 ? ` (${papers.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="benchmarks">
            Benchmarks{benchmarks.length > 0 ? ` (${benchmarks.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* All tab — merged and sorted */}
        <TabsContent value="all">
          <NewsStream updates={updates} news={allNews} />
        </TabsContent>

        {/* Model Updates tab */}
        <TabsContent value="updates">
          {updates.length > 0 ? (
            <div className="space-y-4">
              {updates.map((update) => (
                <UpdateCard key={update.id as string} update={update} />
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
      {merged.slice(0, 80).map((item, i) =>
        item.type === "update" ? (
          <UpdateCard key={`u-${i}`} update={item.data} />
        ) : (
          <NewsCard key={`n-${i}`} item={item.data} />
        )
      )}
    </div>
  );
}

function UpdateCard({ update }: { update: Record<string, unknown> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = update.models as any;

  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[11px]">
                {((update.update_type as string) ?? "update").replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(update.published_at as string)}
              </span>
            </div>
            <h3 className="text-sm font-semibold">{update.title as string}</h3>
            {(update.description as string) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {update.description as string}
              </p>
            ) : null}
            {model ? (
              <Link
                href={`/models/${model.slug}`}
                className="mt-2 inline-block text-xs text-neon hover:underline"
              >
                {model.name} by {model.provider}
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewsCard({ item }: { item: Record<string, unknown> }) {
  const source = item.source as string;
  const tags = (item.tags as string[]) ?? [];

  const sourceLabel =
    source === "arxiv"
      ? "arXiv"
      : source === "hf-papers"
        ? "HF Papers"
        : source === "artificial-analysis"
          ? "Benchmarks"
          : source === "open-llm-leaderboard"
            ? "Leaderboard"
            : source ?? "news";

  const sourceColor =
    source === "arxiv" || source === "hf-papers"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-neon/10 text-neon border-neon/20";

  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={`text-[11px] border ${sourceColor}`}>
                <FlaskConical className="h-3 w-3 mr-1" />
                {sourceLabel}
              </Badge>
              {(item.related_provider as string) ? (
                <Badge variant="outline" className="text-[11px]">
                  {item.related_provider as string}
                </Badge>
              ) : null}
              {(item.category as string) &&
                (item.category as string) !== "general" ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {item.category as string}
                  </Badge>
                ) : null}
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(item.published_at as string)}
              </span>
            </div>
            <h3 className="text-sm font-semibold">{item.title as string}</h3>
            {(item.summary as string) ? (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {item.summary as string}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-3">
              {(item.url as string) ? (
                <a
                  href={item.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neon hover:underline"
                >
                  View Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {tags.length > 0 && (
                <div className="flex gap-1">
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-muted-foreground/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
