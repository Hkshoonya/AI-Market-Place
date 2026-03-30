"use client";

import { useState } from "react";
import { Edit3, MessageSquare, Send, ThumbsUp, Trash2, X } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";
import { formatRelativeDate } from "@/lib/format";
import { clientError } from "@/lib/client-log";
import Image from "next/image";
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
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const commentsKey = `/api/model-comments?modelId=${encodeURIComponent(modelId)}&limit=${visibleCount}`;

  const { data: comments = [], isLoading: loading, mutate } = useSWR<Comment[]>(
    commentsKey,
    async (url: string) => {
      const response = await jsonFetcher<{ comments: Comment[] }>(url);
      return response.comments;
    },
    { ...SWR_TIERS.MEDIUM }
  );

  const submitComment = async (parentId: string | null = null) => {
    if (!user) return;
    const content = parentId ? replyText : newComment;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/model-comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          modelId,
          content: content.trim(),
          parentId,
        }),
      });

      const payload = (await response.json()) as { error?: string; comment?: Comment };
      if (!response.ok || !payload.comment) {
        throw new Error(payload.error ?? "Failed to post comment");
      }

      setSubmitError(null);
      const insertedComment = payload.comment;
      if (parentId) {
        setReplyText("");
        setReplyingTo(null);
        await mutate(
          (current) => (current ?? []).map((c) =>
            c.id === parentId ? { ...c, replies: [...(c.replies ?? []), insertedComment] } : c
          ),
          { revalidate: false }
        );
      } else {
        setNewComment("");
        await mutate(
          (current) => [insertedComment, ...(current ?? [])],
          { revalidate: false }
        );
      }
      void mutate();
    } catch (error) {
      clientError("Comment submit failed:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to post comment. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (commentId: string) => {
    if (!user) return;

    // Optimistic update via SWR
    const optimisticData = comments.map((c) => {
      if (c.id === commentId) return { ...c, upvotes: c.upvotes + 1 };
      if (c.replies) {
        return {
          ...c,
          replies: c.replies.map((r) =>
            r.id === commentId ? { ...r, upvotes: r.upvotes + 1 } : r
          ),
        };
      }
      return c;
    });

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("increment_comment_upvote", { comment_id: commentId });

    if (error) {
      // Revert by revalidating from server
      mutate();
    } else {
      mutate(optimisticData, false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!user || !editText.trim()) return;
    const supabase = createClient();
    await supabase
      .from("comments")
      .update({ content: editText.trim() })
      .eq("id", commentId)
      .eq("user_id", user.id);
    setEditingId(null);
    setEditText("");
    await mutate();
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    if (!confirm("Delete this comment?")) return;
    const supabase = createClient();
    await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);
    await mutate();
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
            <Image
              src={avatarUrl}
              alt={authorName}
              width={32}
              height={32}
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
            {editingId === comment.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-neon text-background hover:bg-neon/90 h-7 text-xs"
                    onClick={() => handleEdit(comment.id)}
                    disabled={!editText.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setEditingId(null); setEditText(""); }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {comment.content}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon transition-colors"
                onClick={() => handleUpvote(comment.id)}
                disabled={!user}
                title={user ? "Upvote" : "Sign in to upvote"}
                aria-label={`Upvote comment${comment.upvotes > 0 ? `, ${comment.upvotes} upvotes` : ""}`}
              >
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
              {user && user.id === comment.user_id && editingId !== comment.id && (
                <>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon transition-colors"
                    onClick={() => { setEditingId(comment.id); setEditText(comment.content); }}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-loss transition-colors"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </>
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
                  aria-label="Send reply"
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
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts on this model..."
                rows={3}
                className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
              />
              {submitError && (
                <p className="mt-2 text-sm text-destructive">{submitError}</p>
              )}
            </div>
            <Button
              className="bg-neon text-background font-semibold hover:bg-neon/90 self-end"
              onClick={() => submitComment(null)}
              disabled={submitting || !newComment.trim()}
            >
              <Send className="mr-1 h-4 w-4" />
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
          <>
            <div className="divide-y divide-border/30">
              {comments.map((comment) => renderComment(comment))}
            </div>
            {comments.length >= visibleCount && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                >
                  Load more comments
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
