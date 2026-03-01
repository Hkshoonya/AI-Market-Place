import { ExternalLink, FlaskConical, Twitter, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/format";
import Link from "next/link";

interface NewsCardProps {
  item: Record<string, unknown>;
  /** Show linked model names below the title */
  showModelLinks?: boolean;
  /** Linked models data (from join or lookup) */
  linkedModels?: Array<{ slug: string; name: string }>;
}

const sourceConfig: Record<
  string,
  { label: string; color: string; icon: "flask" | "twitter" | "rss" }
> = {
  arxiv: {
    label: "arXiv",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: "flask",
  },
  "hf-papers": {
    label: "HF Papers",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: "flask",
  },
  "artificial-analysis": {
    label: "Benchmarks",
    color: "bg-neon/10 text-neon border-neon/20",
    icon: "flask",
  },
  "open-llm-leaderboard": {
    label: "Leaderboard",
    color: "bg-neon/10 text-neon border-neon/20",
    icon: "flask",
  },
  "x-twitter": {
    label: "X/Twitter",
    color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    icon: "twitter",
  },
  "provider-blog": {
    label: "Blog",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: "rss",
  },
};

export function NewsCard({ item, showModelLinks, linkedModels }: NewsCardProps) {
  const source = item.source as string;
  const tags = Array.isArray(item.tags) ? (item.tags as string[]) : [];
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;

  const config = sourceConfig[source] ?? {
    label: source ?? "news",
    color: "bg-muted text-muted-foreground border-border",
    icon: "flask" as const,
  };
  const IconComponent =
    config.icon === "twitter"
      ? Twitter
      : config.icon === "rss"
        ? Rss
        : FlaskConical;

  const handle = metadata.handle as string | undefined;

  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={`text-[11px] border ${config.color}`}>
                <IconComponent className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {handle && (
                <Badge variant="outline" className="text-[11px]">
                  @{handle}
                </Badge>
              )}
              {(item.related_provider as string) ? (
                <Badge variant="outline" className="text-[11px]">
                  {item.related_provider as string}
                </Badge>
              ) : null}
              {(item.category as string) &&
              !["general", "social", "benchmark"].includes(
                item.category as string
              ) ? (
                <Badge variant="secondary" className="text-[11px]">
                  {item.category as string}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(item.published_at as string)}
              </span>
            </div>
            <h3 className="text-sm font-semibold">{item.title as string}</h3>
            {(item.summary as string) &&
            (item.summary as string) !== (item.title as string) ? (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {item.summary as string}
              </p>
            ) : null}
            {/* Linked model names */}
            {showModelLinks && linkedModels && linkedModels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {linkedModels.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/models/${m.slug}`}
                    className="text-[11px] text-neon hover:underline"
                  >
                    {m.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              {(item.url as string) ? (
                <a
                  href={item.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neon hover:underline"
                >
                  {source === "x-twitter" ? "View Post" : "View Source"}
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

export function UpdateCard({ update }: { update: Record<string, unknown> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = update.models as any;

  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[11px]">
                {((update.update_type as string) ?? "update").replace(
                  /_/g,
                  " "
                )}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(update.published_at as string)}
              </span>
            </div>
            <h3 className="text-sm font-semibold">
              {update.title as string}
            </h3>
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

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
