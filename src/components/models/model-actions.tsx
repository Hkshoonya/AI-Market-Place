"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

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

  const supabase = createClient();

  useEffect(() => {
    if (user && modelId) {
      // Check DB bookmark
      const check = async () => {
        const { data } = await supabase
          .from("user_bookmarks")
          .select("id")
          .eq("user_id", user.id)
          .eq("model_id", modelId)
          .maybeSingle();
        setIsBookmarked(!!data);
      };
      check();
    } else {
      // Fallback to localStorage
      setIsBookmarked(getLocalBookmarks().includes(modelSlug));
    }
  }, [modelSlug, modelId, user]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleBookmark = async () => {
    if (user && modelId) {
      // DB bookmark
      if (isBookmarked) {
        await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("model_id", modelId);
        setIsBookmarked(false);
        setShowToast(`${modelName} removed from bookmarks`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("user_bookmarks")
          .insert({ user_id: user.id, model_id: modelId });
        setIsBookmarked(true);
        setShowToast(`${modelName} bookmarked`);
      }
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
