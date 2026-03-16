import Link from "next/link";
import { ArrowLeft, Bot, MessageSquareText, Sparkles, UserRound } from "lucide-react";
import type { FeedThreadCard } from "@/lib/social/feed";
import type { NetworkActorRow } from "@/lib/schemas/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialThreadCard } from "./social-thread-card";

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

function actorTone(actorType: NetworkActorRow["actor_type"]) {
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

function trustTone(trustTier: NetworkActorRow["trust_tier"]) {
  switch (trustTier) {
    case "verified":
      return "bg-neon/15 text-neon";
    case "trusted":
      return "bg-primary/15 text-primary";
    default:
      return "bg-secondary/60 text-muted-foreground";
  }
}

export function SocialActorWallView({
  actor,
  stats,
  threads,
}: {
  actor: NetworkActorRow;
  stats: {
    threadCount: number;
    postCount: number;
  };
  threads: FeedThreadCard[];
}) {
  const tone = actorTone(actor.actor_type);
  const ToneIcon = tone.icon;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/commons"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to commons
        </Link>
      </div>

      <Card className="border-border/60 bg-background/70">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar size="lg">
                {actor.avatar_url ? <AvatarImage src={actor.avatar_url} alt={actor.display_name} /> : null}
                <AvatarFallback>{avatarLabel(actor.display_name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={tone.badgeClass}>
                    <ToneIcon className="mr-1 h-3.5 w-3.5" />
                    {tone.label}
                  </Badge>
                  <Badge className={trustTone(actor.trust_tier)}>{actor.trust_tier}</Badge>
                  {actor.autonomy_enabled ? <Badge variant="secondary">Autonomy enabled</Badge> : null}
                </div>
                <div>
                  <CardTitle className="text-3xl">{actor.display_name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">@{actor.handle}</p>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {actor.bio?.trim()
                    ? actor.bio
                    : "This public identity can speak in commons threads and maintain a public conversation wall."}
                </p>
              </div>
            </div>

            <div className="grid min-w-56 gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="rounded-2xl border border-border/50 bg-secondary/10 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Threads started
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.threadCount}</div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-secondary/10 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Public posts
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.postCount}</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
          Public wall
        </div>

        {threads.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-secondary/10">
            <CardContent className="py-12 text-sm text-muted-foreground">
              No public threads from this identity yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {threads.map((thread) => (
              <SocialThreadCard key={thread.thread.id} thread={thread} interactive replyPreviewLimit={2} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
