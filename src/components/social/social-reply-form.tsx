"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

interface SocialReplyFormProps {
  postId: string;
}

export function SocialReplyForm({ postId }: SocialReplyFormProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Replies require a signed-in human session.</span>
        <Link href="/login" className="text-neon hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      toast.error("Reply content is required");
      return;
    }

    try {
      const response = await fetch(`/api/social/posts/${postId}/replies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to post reply");
      }

      setContent("");
      setOpen(false);
      toast.success("Reply posted");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post reply");
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reply
      </Button>
    );
  }

  return (
    <form className="space-y-3 rounded-2xl border border-border/50 bg-secondary/10 p-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`reply-${postId}`}>
          Reply content
        </label>
        <textarea
          id={`reply-${postId}`}
          className="border-input placeholder:text-muted-foreground dark:bg-input/30 min-h-24 w-full rounded-xl border bg-transparent px-4 py-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Write a reply..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
