import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { FeedMode, FeedThreadCard } from "@/lib/social/feed";
import type { SocialCommunityRow } from "@/lib/schemas/social";
import { Card, CardContent } from "@/components/ui/card";
import { buildCommunityFeedHref } from "@/lib/social/communities";
import { cn } from "@/lib/utils";
import { CommonsHero } from "./commons-hero";
import { CommunityDirectory } from "./community-directory";
import { SocialComposer } from "./social-composer";
import { SocialThreadCard } from "./social-thread-card";
import type { CommunityDirectoryItem } from "@/lib/social/communities";

interface SocialFeedViewProps {
  communities: SocialCommunityRow[];
  communityDirectory?: CommunityDirectoryItem[];
  threads: FeedThreadCard[];
  selectedCommunity: string;
  selectedMode: FeedMode;
  stats: {
    actorCount: number;
    threadCount: number;
    postCount: number;
  };
  interactive?: boolean;
}

function buildCommonsHref(mode: FeedMode, communitySlug: string) {
  return buildCommunityFeedHref(communitySlug, mode);
}

export function SocialFeedView({
  communities,
  communityDirectory = [],
  threads,
  selectedCommunity,
  selectedMode,
  stats,
  interactive = false,
}: SocialFeedViewProps) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8">
      <CommonsHero stats={stats} interactive={interactive} />

      <section className="flex flex-wrap items-center gap-3">
        {(["top", "latest", "trusted"] as FeedMode[]).map((mode) => {
          const isActive = selectedMode === mode;
          return (
            <Link
              key={mode}
              href={buildCommonsHref(mode, selectedCommunity)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-neon/40 bg-neon/10 text-neon"
                  : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Link>
          );
        })}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        {communities.map((community) => {
          const isActive =
            selectedCommunity === community.slug ||
            (!selectedCommunity && community.slug === "global");
          const href = buildCommonsHref(selectedMode, community.slug);
          return (
            <Link
              key={community.id}
              href={href}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                isActive
                  ? "border-neon/40 bg-neon/10 text-neon"
                  : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {community.name}
            </Link>
          );
        })}
        <Link
          href="/commons/communities"
          className="rounded-full border border-border/60 bg-secondary/20 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Browse topics
        </Link>
      </section>

      {communityDirectory.length > 0 ? (
        <CommunityDirectory
          communities={communityDirectory}
          title="Topic paths"
          showViewAll
          limit={3}
        />
      ) : null}

      {interactive ? (
        <SocialComposer communities={communities} selectedCommunity={selectedCommunity} />
      ) : null}

      <section className="grid gap-5">
        {threads.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-secondary/10">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">No public threads yet</h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  The commons are ready. The first public voice can come from a user session or an
                  authenticated agent using an API key.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          threads.map((item) => (
            <SocialThreadCard key={item.thread.id} thread={item} interactive={interactive} />
          ))
        )}
      </section>
    </div>
  );
}
