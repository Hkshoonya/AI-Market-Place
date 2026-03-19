import Link from "next/link";
import Image from "next/image";
import { Bot, ExternalLink, MessageSquare, Sparkles, UserRound } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { FeedThreadCard } from "@/lib/social/feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialReplyForm } from "./social-reply-form";
import { SocialReportButton } from "./social-report-button";

interface SocialThreadCardProps {
  thread: FeedThreadCard;
  interactive?: boolean;
  replyPreviewLimit?: number | null;
  showOpenThreadLink?: boolean;
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

function formatReputation(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function avatarLabel(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function actorHref(handle: string) {
  return `/commons/actors/${handle}`;
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

function PostLinkPreviewList({
  previews,
}: {
  previews: FeedThreadCard["rootPost"]["linkPreviews"] | undefined;
}) {
  if (!previews || previews.length === 0) return null;

  return (
    <div className="grid gap-3">
      {previews.map((preview) => (
        <a
          key={preview.id}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-2xl border border-border/50 bg-background/60 p-4 transition-colors hover:border-neon/40"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">{preview.label}</div>
              <div className="text-xs text-muted-foreground">
                {preview.handle ? `@${preview.handle} · ` : ""}
                {preview.source_host ?? "external"}
                {preview.tweet_id ? ` · ${preview.tweet_id}` : ""}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-neon">
              {preview.action_label ?? "Open link"}
              <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

export function SocialThreadCard({
  thread,
  interactive = false,
  replyPreviewLimit = 3,
  showOpenThreadLink = true,
}: SocialThreadCardProps) {
  const actorKind = actorTone(thread.rootPost.author.actor_type);
  const ActorIcon = actorKind.icon;
  const isRootRemoved = thread.rootPost.status === "removed";
  const visibleReplies =
    replyPreviewLimit === null ? thread.replies : thread.replies.slice(0, replyPreviewLimit);
  const participantCount = new Set([
    thread.rootPost.author.id,
    ...thread.replies.map((reply) => reply.author.id),
  ]).size;
  const rootReputation = formatReputation(thread.rootPost.author.reputation_score);

  return (
    <Card className="overflow-hidden border-border/60 bg-card/70">
      <CardHeader className="gap-4 border-b border-border/50 bg-secondary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={actorKind.badgeClass}>
                <ActorIcon className="mr-1 h-3.5 w-3.5" />
                {actorKind.label}
              </Badge>
              <Badge className={trustTone(thread.rootPost.author.trust_tier)}>
                {thread.rootPost.author.trust_tier}
              </Badge>
              {rootReputation != null ? (
                <Badge variant="outline">Rep {rootReputation}</Badge>
              ) : null}
              {thread.thread.community?.name ? (
                <Badge variant="secondary">{thread.thread.community.name}</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(thread.thread.last_posted_at)}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Avatar size="lg">
                {thread.rootPost.author.avatar_url ? (
                  <AvatarImage
                    src={thread.rootPost.author.avatar_url}
                    alt={thread.rootPost.author.display_name}
                  />
                ) : null}
                <AvatarFallback>{avatarLabel(thread.rootPost.author.display_name)}</AvatarFallback>
              </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-2xl">
                  {showOpenThreadLink ? (
                    <Link
                      href={`/commons/threads/${thread.thread.id}`}
                      className="transition-colors hover:text-neon"
                    >
                      {thread.thread.title ?? thread.rootPost.content.slice(0, 90)}
                    </Link>
                  ) : (
                    (thread.thread.title ?? thread.rootPost.content.slice(0, 90))
                  )}
                  </CardTitle>
                  <Link
                    href={actorHref(thread.rootPost.author.handle)}
                    className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {thread.rootPost.author.display_name}
                    </span>{" "}
                    <span>@{thread.rootPost.author.handle}</span>
                  </Link>
                </div>
              </div>
            </div>
          <div className="min-w-40 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Conversation
            </div>
            <div className="mt-2 text-2xl font-semibold">{thread.thread.reply_count}</div>
            <div className="text-sm text-muted-foreground">replies in this thread</div>
            <div className="mt-2 text-xs text-muted-foreground">
              {participantCount} participant{participantCount === 1 ? "" : "s"}
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
              {thread.rootPost.moderation_reason ? ` Reason: ${thread.rootPost.moderation_reason}.` : ""}
            </p>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-base leading-7 text-foreground/95">
              {thread.rootPost.content}
            </p>
            <PostImageGallery
              media={thread.rootPost.media}
              context={thread.thread.title ?? thread.rootPost.author.display_name}
            />
            <PostLinkPreviewList previews={thread.rootPost.linkPreviews} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {interactive ? <SocialReportButton postId={thread.rootPost.id} /> : <div />}
              {showOpenThreadLink ? (
                <Link
                  href={`/commons/threads/${thread.thread.id}`}
                  className="text-sm font-medium text-neon transition-colors hover:text-neon/80"
                >
                  Open thread
                </Link>
              ) : null}
            </div>
          </>
        )}

        {visibleReplies.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-border/50 bg-secondary/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {replyPreviewLimit === null ? "Replies" : "Reply preview"}
            </div>
            {visibleReplies.map((reply) => (
              <div key={reply.id} className="rounded-xl border border-border/40 bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={actorHref(reply.author.handle)}
                      className="text-sm font-medium transition-colors hover:text-neon"
                    >
                      {reply.author.display_name}{" "}
                      <span className="font-normal text-muted-foreground">@{reply.author.handle}</span>
                    </Link>
                    <Badge className={trustTone(reply.author.trust_tier)}>
                      {reply.author.trust_tier}
                    </Badge>
                    {formatReputation(reply.author.reputation_score) != null ? (
                      <Badge variant="outline">Rep {formatReputation(reply.author.reputation_score)}</Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm leading-6 text-foreground/90">{reply.content}</p>
                <div className="mt-3">
                  <PostImageGallery media={reply.media} context={`${reply.author.display_name} reply`} />
                </div>
                <div className="mt-3">
                  <PostLinkPreviewList previews={reply.linkPreviews} />
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

        {interactive && !isRootRemoved ? <SocialReplyForm postId={thread.rootPost.id} /> : null}
      </CardContent>
    </Card>
  );
}
