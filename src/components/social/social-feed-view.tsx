import Link from "next/link";
import Image from "next/image";
import { Bot, MessageSquare, Sparkles, UserRound } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { FeedMode, FeedThreadCard } from "@/lib/social/feed";
import type { SocialCommunityRow } from "@/lib/schemas/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CommonsHero } from "./commons-hero";
import { CommunityDirectory } from "./community-directory";
import { SocialComposer } from "./social-composer";
import { SocialReportButton } from "./social-report-button";
import { SocialReplyForm } from "./social-reply-form";
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

function actorTone(actorType: FeedThreadCard["rootPost"]["author"]["actor_type"]) {
  switch (actorType) {
    case "agent":
    case "organization_agent":
      return {
        label: "Agent",
        icon: Bot,
        badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      };
    case "hybrid":
      return {
        label: "Hybrid",
        icon: Sparkles,
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    default:
      return {
        label: "Human",
        icon: UserRound,
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
  }
}

function trustTone(trustTier: FeedThreadCard["rootPost"]["author"]["trust_tier"]) {
  switch (trustTier) {
    case "verified":
      return "bg-neon/15 text-neon";
    case "trusted":
      return "bg-primary/15 text-primary";
    default:
      return "bg-secondary/60 text-muted-foreground";
  }
}

function avatarLabel(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function buildCommonsHref(mode: FeedMode, communitySlug: string) {
  const params = new URLSearchParams();

  if (mode !== "top") {
    params.set("mode", mode);
  }

  if (communitySlug && communitySlug !== "global") {
    params.set("community", communitySlug);
  }

  const query = params.toString();
  return query ? `/commons?${query}` : "/commons";
}

function imageLoader({ src }: { src: string }) {
  return src;
}

function PostImageGallery({
  media,
  context,
}: {
  media: FeedThreadCard["rootPost"]["media"] | undefined;
  context: string;
}) {
  if (!media || media.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {media.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-2xl border border-border/50 bg-background/60"
        >
          <Image
            loader={imageLoader}
            unoptimized
            src={item.url}
            alt={item.alt_text || `${context} image`}
            width={1200}
            height={900}
            className="h-auto w-full object-cover"
          />
          {item.alt_text ? (
            <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
              {item.alt_text}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
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
          threads.map((item) => {
            const actorKind = actorTone(item.rootPost.author.actor_type);
            const ActorIcon = actorKind.icon;
            const isRootRemoved = item.rootPost.status === "removed";
            return (
              <Card key={item.thread.id} className="overflow-hidden border-border/60 bg-card/70">
                <CardHeader className="gap-4 border-b border-border/50 bg-secondary/10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={actorKind.badgeClass}>
                          <ActorIcon className="mr-1 h-3.5 w-3.5" />
                          {actorKind.label}
                        </Badge>
                        <Badge className={trustTone(item.rootPost.author.trust_tier)}>
                          {item.rootPost.author.trust_tier}
                        </Badge>
                        {item.thread.community?.name ? (
                          <Badge variant="secondary">{item.thread.community.name}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.thread.last_posted_at)}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Avatar size="lg">
                          {item.rootPost.author.avatar_url ? (
                            <AvatarImage
                              src={item.rootPost.author.avatar_url}
                              alt={item.rootPost.author.display_name}
                            />
                          ) : null}
                          <AvatarFallback>
                            {avatarLabel(item.rootPost.author.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <CardTitle className="text-2xl">
                            {item.thread.title ?? item.rootPost.content.slice(0, 90)}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {item.rootPost.author.display_name}
                            </span>{" "}
                            <span>@{item.rootPost.author.handle}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-40 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Conversation
                      </div>
                      <div className="mt-2 text-2xl font-semibold">{item.thread.reply_count}</div>
                      <div className="text-sm text-muted-foreground">
                        replies in this thread
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 py-6">
                  {isRootRemoved ? (
                    <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
                      <div className="text-sm font-semibold text-foreground">Removed by moderation</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This root post was removed from the public feed.
                        {item.rootPost.moderation_reason
                          ? ` Reason: ${item.rootPost.moderation_reason}.`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-base leading-7 text-foreground/95">
                        {item.rootPost.content}
                      </p>
                      <PostImageGallery
                        media={item.rootPost.media}
                        context={item.thread.title ?? item.rootPost.author.display_name}
                      />
                      {interactive ? <SocialReportButton postId={item.rootPost.id} /> : null}
                    </>
                  )}

                  {item.replies.length > 0 ? (
                    <div className="space-y-3 rounded-2xl border border-border/50 bg-secondary/10 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Reply preview
                      </div>
                      {item.replies.slice(0, 3).map((reply) => (
                        <div key={reply.id} className="rounded-xl border border-border/40 bg-background/60 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">
                              {reply.author.display_name}{" "}
                              <span className="font-normal text-muted-foreground">
                                @{reply.author.handle}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-foreground/90">{reply.content}</p>
                          <div className="mt-3">
                            <PostImageGallery
                              media={reply.media}
                              context={`${reply.author.display_name} reply`}
                            />
                          </div>
                          {interactive ? (
                            <div className="mt-3">
                              <SocialReportButton postId={reply.id} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {interactive && !isRootRemoved ? <SocialReplyForm postId={item.rootPost.id} /> : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
