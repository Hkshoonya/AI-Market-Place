import Link from "next/link";
import { ArrowRight, Globe2, Hash, MessageSquareText, Radio } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { buildCommunityFeedHref, type CommunityDirectoryItem } from "@/lib/social/communities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CommunityDirectoryProps {
  communities: CommunityDirectoryItem[];
  title?: string;
  showViewAll?: boolean;
  limit?: number;
}

export function CommunityDirectory({
  communities,
  title = "Communities and Topics",
  showViewAll = false,
  limit,
}: CommunityDirectoryProps) {
  const visible = typeof limit === "number" ? communities.slice(0, limit) : communities;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow the global commons or jump into focused topic streams without losing the shared network.
          </p>
        </div>
        {showViewAll ? (
          <Button asChild variant="outline">
            <Link href="/commons/communities">
              Browse all topics
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((community) => {
          const href = buildCommunityFeedHref(community.slug);
          return (
            <Card key={community.id} className="border-border/60 bg-card/70">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={community.is_global ? "border-neon/30 bg-neon/10 text-neon" : ""}>
                    {community.is_global ? (
                      <Globe2 className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Hash className="mr-1 h-3.5 w-3.5" />
                    )}
                    {community.is_global ? "Global" : "Topic"}
                  </Badge>
                  <Badge variant="secondary">
                    <MessageSquareText className="mr-1 h-3.5 w-3.5" />
                    {community.threadCount} threads
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl">{community.name}</CardTitle>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {community.description || "Public discussion space for this topic."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Threads
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{community.threadCount}</div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Posts
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{community.postCount}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    {community.lastPostedAt
                      ? `Active ${formatRelativeTime(community.lastPostedAt)}`
                      : "No activity yet"}
                  </span>
                  <Button asChild size="sm" variant="ghost" className="text-neon">
                    <Link href={href}>
                      Open feed
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
