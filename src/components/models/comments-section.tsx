"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import Link from "next/link";

interface Comment {
  id: string;
  content: string;
  upvotes: number;
  created_at: string;
  parent_id: string | null;
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  replies?: Comment[];
}

interface CommentsSectionProps {
  modelId: string;
}

export function CommentsSection({ modelId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(display_name, avatar_url, username)")
      .eq("model_id", modelId)
      .order("created_at", { ascending: false });

    if (data) {
      // Organize into threads
      const topLevel: Comment[] = [];
      const replyMap = new Map<string, Comment[]>();

      for (const c of data as Comment[]) {
        if (c.parent_id) {
          const existing = replyMap.get(c.parent_id) ?? [];
          existing.push(c);
          replyMap.set(c.parent_id, existing);
        } else {
          topLevel.push(c);
        }
      }

      for (const c of topLevel) {
        c.replies = replyMap.get(c.id) ?? [];
      }

      setComments(topLevel);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [modelId]);

  const submitComment = async (parentId: string | null = null) => {
    if (!user) return;
    const content = parentId ? replyText : newComment;
    if (!content.trim()) return;

    setSubmitting(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("comments").insert({
      model_id: modelId,
      user_id: user.id,
      content: content.trim(),
      parent_id: parentId,
    });

    if (!error) {
      if (parentId) {
        setReplyText("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }
      await fetchComments();
    }

    setSubmitting(false);
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const authorName =
      comment.profiles?.display_name ??
      comment.profiles?.username ??
      "Anonymous";
    const avatarUrl = comment.profiles?.avatar_url;
    const initial = authorName.charAt(0).toUpperCase();

    return (
      <div
        key={comment.id}
        className={`${isReply ? "ml-8 border-l border-border/30 pl-4" : ""}`}
      >
        <div className="flex gap-3 py-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={authorName}
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon/10 text-xs font-bold text-neon shrink-0">
              {initial}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{authorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(comment.created_at)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {comment.content}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ThumbsUp className="h-3 w-3" />
                {comment.upvotes > 0 && comment.upvotes}
              </button>
              {user && !isReply && (
                <button
                  className="text-xs text-muted-foreground hover:text-neon"
                  onClick={() =>
                    setReplyingTo(
                      replyingTo === comment.id ? null : comment.id
                    )
                  }
                >
                  Reply
                </button>
              )}
            </div>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="flex-1 rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
                />
                <Button
                  size="sm"
                  className="bg-neon text-background hover:bg-neon/90 self-end"
                  onClick={() => submitComment(comment.id)}
                  disabled={submitting || !replyText.trim()}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Render replies */}
        {comment.replies?.map((reply) => renderComment(reply, true))}
      </div>
    );
  };

  return (
    <Card className="mt-8 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-neon" />
          Discussion ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* New comment form */}
        {user ? (
          <div className="mb-6 flex gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this model..."
              rows={3}
              className="flex-1 rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
            />
            <Button
              className="bg-neon text-background font-semibold hover:bg-neon/90 self-end"
              onClick={() => submitComment(null)}
              disabled={submitting || !newComment.trim()}
            >
              <Send className="h-4 w-4 mr-1" />
              Post
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-border/30 bg-secondary/20 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-neon hover:underline">
                Sign in
              </Link>{" "}
              to join the discussion
            </p>
          </div>
        )}

        {/* Comments list */}
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading comments...
          </div>
        ) : comments.length > 0 ? (
          <div className="divide-y divide-border/30">
            {comments.map((comment) => renderComment(comment))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
