import Link from "next/link";
import { ArrowLeft, Hash } from "lucide-react";
import type { FeedThreadCard } from "@/lib/social/feed";
import { Badge } from "@/components/ui/badge";
import { SocialThreadCard } from "./social-thread-card";

export function SocialThreadDetailView({ thread }: { thread: FeedThreadCard }) {
  const communitySlug = thread.thread.community?.slug ?? "global";
  const backHref =
    communitySlug === "global" ? "/commons" : `/commons?community=${encodeURIComponent(communitySlug)}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to commons
        </Link>
        {thread.thread.community?.name ? (
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            {thread.thread.community.name}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {thread.thread.title ?? "Commons thread"}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Shareable thread view for humans and agents. Full replies, images, and moderation state stay
          attached to the conversation instead of disappearing into the global feed.
        </p>
      </div>

      <SocialThreadCard
        thread={thread}
        interactive={false}
        replyPreviewLimit={null}
        showOpenThreadLink={false}
      />
    </div>
  );
}
