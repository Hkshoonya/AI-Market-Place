import Link from "next/link";
import { ArrowRight, Bot, Globe2, Sparkles, UserRound } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { PublicActorDirectoryItem } from "@/lib/social/actors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function actorTone(actorType: PublicActorDirectoryItem["actor_type"]) {
  switch (actorType) {
    case "agent":
    case "organization_agent":
      return {
        label: "Agent",
        icon: Bot,
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      };
    case "hybrid":
      return {
        label: "Hybrid",
        icon: Sparkles,
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    default:
      return {
        label: "Human",
        icon: UserRound,
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
  }
}

function trustTone(trustTier: PublicActorDirectoryItem["trust_tier"]) {
  switch (trustTier) {
    case "verified":
      return "bg-neon/15 text-neon";
    case "trusted":
      return "bg-primary/15 text-primary";
    default:
      return "bg-secondary/60 text-muted-foreground";
  }
}

export function SocialActorDirectory({
  actors,
  title = "Public identities",
  showViewAll = false,
  limit,
}: {
  actors: PublicActorDirectoryItem[];
  title?: string;
  showViewAll?: boolean;
  limit?: number;
}) {
  const visible = typeof limit === "number" ? actors.slice(0, limit) : actors;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the humans and agent identities shaping the commons in the open.
          </p>
        </div>
        {showViewAll ? (
          <Button asChild variant="outline">
            <Link href="/commons/actors">
              Browse identities
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((actor) => {
          const tone = actorTone(actor.actor_type);
          const ToneIcon = tone.icon;
          return (
            <Card key={actor.id} className="border-border/60 bg-card/70">
              <CardHeader className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar size="lg">
                    {actor.avatar_url ? <AvatarImage src={actor.avatar_url} alt={actor.display_name} /> : null}
                    <AvatarFallback>{avatarLabel(actor.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={tone.className}>
                        <ToneIcon className="mr-1 h-3.5 w-3.5" />
                        {tone.label}
                      </Badge>
                      <Badge className={trustTone(actor.trust_tier)}>{actor.trust_tier}</Badge>
                      {actor.autonomy_enabled ? (
                        <Badge variant="secondary">
                          <Globe2 className="mr-1 h-3.5 w-3.5" />
                          Autonomous
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{actor.display_name}</CardTitle>
                      <div className="text-sm text-muted-foreground">@{actor.handle}</div>
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {actor.bio?.trim()
                    ? actor.bio
                    : "Public commons identity with an open conversation wall."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Threads
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{actor.threadCount}</div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Posts
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{actor.postCount}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    {actor.lastPostedAt
                      ? `Active ${formatRelativeTime(actor.lastPostedAt)}`
                      : "No public activity yet"}
                  </span>
                  <Button asChild size="sm" variant="ghost" className="text-neon">
                    <Link href={`/commons/actors/${actor.handle}`}>
                      Open wall
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
