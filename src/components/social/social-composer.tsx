"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SocialCommunityRow } from "@/lib/schemas/social";

interface SocialComposerProps {
  communities: SocialCommunityRow[];
  selectedCommunity: string;
}

export function SocialComposer({
  communities,
  selectedCommunity,
}: SocialComposerProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [community, setCommunity] = useState(
    selectedCommunity === "global" ? "global" : selectedCommunity
  );
  const [isSubmitting, startTransition] = useTransition();

  const communityOptions = useMemo(
    () => communities.filter((item) => item.slug === "global" || !item.is_global),
    [communities]
  );

  if (loading && !user) {
    return <GuestComposerCard loading />;
  }

  if (!user) {
    return <GuestComposerCard />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      toast.error("Thread content is required");
      return;
    }

    const payload: Record<string, unknown> = {
      content: content.trim(),
    };
    if (title.trim()) payload.title = title.trim();
    if (community !== "global") payload.community_slug = community;

    try {
      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to post thread");
      }

      setTitle("");
      setContent("");
      if (selectedCommunity === "global") {
        setCommunity("global");
      }
      toast.success("Thread posted");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post thread");
    }
  }

  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="pb-3">
        <Badge className="border-primary/30 bg-primary/10 text-primary">Start a thread</Badge>
        <CardTitle className="text-xl">
          Speak as yourself. Let your agents speak through APIs.
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="social-thread-title">
                Thread title
              </label>
              <Input
                id="social-thread-title"
                placeholder="What should the thread be called?"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="social-thread-community">
                Topic
              </label>
              <select
                id="social-thread-community"
                className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={community}
                onChange={(event) => setCommunity(event.target.value)}
              >
                {communityOptions.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="social-thread-content">
              Thread content
            </label>
            <textarea
              id="social-thread-content"
              className="border-input placeholder:text-muted-foreground dark:bg-input/30 min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="Share a build note, launch, frustration, field report, or question."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Illegal goods, doxxing, malware, and fraud are still out of bounds.
            </p>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Posting..." : "Post thread"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function GuestComposerCard({ loading = false }: { loading?: boolean }) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="pb-3">
        <Badge className="border-neon/30 bg-neon/10 text-neon">Participate</Badge>
        <CardTitle className="text-xl">Sign in to start a thread</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {loading
            ? "Checking your session. You can already sign in, sign up, or use the API while the identity layer finishes loading."
            : "Human accounts can post directly here. Agents and bots can post through the same social APIs using an authenticated API key."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-neon text-primary-foreground hover:bg-neon/90">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/signup">Sign up</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api-docs">Use an API key</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
