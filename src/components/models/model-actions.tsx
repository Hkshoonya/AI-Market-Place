"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { BarChart3, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { AddToWatchlist } from "@/components/watchlists/add-to-watchlist";
import { SWR_TIERS } from "@/lib/swr/config";

interface ModelActionsProps {
  modelSlug: string;
  modelName: string;
  modelId?: string;
}

const BOOKMARKS_KEY = "aimc_bookmarks";

function getLocalBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function toggleLocalBookmark(slug: string): boolean {
  const bookmarks = getLocalBookmarks();
  const index = bookmarks.indexOf(slug);
  if (index >= 0) {
    bookmarks.splice(index, 1);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return false;
  } else {
    bookmarks.push(slug);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return true;
  }
}

export function ModelActions({ modelSlug, modelName, modelId }: ModelActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // SWR for bookmark check with auth-gated null key
  const { data: dbBookmarked, mutate: mutateBookmark } = useSWR<boolean>(
    user && modelId ? `supabase:bookmark:${user.id}:${modelId}` : null,
    async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_bookmarks")
        .select("id")
        .eq("user_id", user!.id)
        .eq("model_id", modelId!)
        .maybeSingle();
      return !!data;
    },
    { ...SWR_TIERS.SLOW }
  );

  // Sync bookmark state from SWR data (DB) or localStorage fallback
  useEffect(() => {
    if (user && modelId) {
      if (dbBookmarked !== undefined) {
        setIsBookmarked(dbBookmarked);
      }
    } else {
      setIsBookmarked(getLocalBookmarks().includes(modelSlug));
    }
  }, [dbBookmarked, user, modelId, modelSlug]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleBookmark = async () => {
    if (user && modelId) {
      const supabase = createClient();
      // DB bookmark
      if (isBookmarked) {
        await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("model_id", modelId);
        setShowToast(`${modelName} removed from bookmarks`);
      } else {
        await supabase
          .from("user_bookmarks")
          .insert({ user_id: user.id, model_id: modelId });
        setShowToast(`${modelName} bookmarked`);
      }
      await mutateBookmark();
    } else {
      // localStorage fallback
      const nowBookmarked = toggleLocalBookmark(modelSlug);
      setIsBookmarked(nowBookmarked);
      setShowToast(
        nowBookmarked
          ? `${modelName} bookmarked`
          : `${modelName} removed from bookmarks`
      );
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-2 transition-colors",
          isBookmarked && "border-neon/30 bg-neon/10 text-neon"
        )}
        onClick={handleBookmark}
      >
        <Heart
          className={cn("h-4 w-4", isBookmarked && "fill-neon text-neon")}
        />
        {isBookmarked ? "Bookmarked" : "Bookmark"}
      </Button>

      {modelId && (
        <AddToWatchlist modelId={modelId} modelName={modelName} />
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          router.push(`/compare?models=${modelSlug}`);
        }}
      >
        <BarChart3 className="h-4 w-4" />
        Compare
      </Button>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-2 text-sm shadow-lg">
            {showToast}
          </div>
        </div>
      )}
    </>
  );
}
