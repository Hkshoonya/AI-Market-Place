import Link from "next/link";
import { Eye, Globe, Layers, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDate } from "@/lib/format";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Watchlists",
  description:
    "Browse public AI model watchlists curated by the community. Find collections of models organized by use case, provider, or category.",
};

export const revalidate = 1800;

const PAGE_SIZE = 24;

export default async function DiscoverPage(props: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q: searchQuery } = await props.searchParams;
  const page = Math.max(1, parseInt(pageParam || "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Build query with pagination and optional search
  let query = supabase
    .from("watchlists")
    .select(
      "id, name, description, is_public, created_at, updated_at, user_id, profiles(display_name, username, avatar_url), watchlist_items(id)",
      { count: "exact" }
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (searchQuery && searchQuery.length >= 2) {
    const sanitizedSearch = sanitizeFilterValue(searchQuery);
    if (sanitizedSearch) {
      query = query.or(
        `name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`
      );
    }
  }

  const { data: watchlistsRaw, count } = await query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const watchlists = (watchlistsRaw as any[] | null) ?? [];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Globe className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Discover Watchlists</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Browse {count ?? 0} public watchlists curated by the community.
      </p>

      {/* Search */}
      <form className="mb-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery ?? ""}
            placeholder="Search watchlists..."
            className="w-full rounded-lg border border-border/50 bg-secondary py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
          />
        </div>
      </form>

      {searchQuery && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Results for &quot;{searchQuery}&quot;
          </span>
          <Link
            href="/discover"
            className="text-xs text-neon hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      {watchlists.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watchlists.map((wl) => {
              const itemCount = wl.watchlist_items?.length ?? 0;
              const creator = wl.profiles;

              return (
                <Link key={wl.id} href={`/watchlists/${wl.id}`}>
                  <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon/10">
                          <Eye className="h-5 w-5 text-neon" />
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[11px] border-neon/30 text-neon"
                        >
                          <Layers className="mr-1 h-3 w-3" />
                          {itemCount} model{itemCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors line-clamp-1">
                        {wl.name}
                      </h3>

                      {wl.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {wl.description}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>
                            {creator?.display_name ||
                              creator?.username ||
                              "Anonymous"}
                          </span>
                        </div>
                        <span>
                          Updated {formatRelativeDate(wl.updated_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/discover?page=${page - 1}${searchQuery ? `&q=${searchQuery}` : ""}`}
                  className="rounded-lg border border-border/50 px-3 py-1.5 text-sm hover:border-neon/30 hover:text-neon transition-colors"
                >
                  Previous
                </Link>
              )}
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/discover?page=${page + 1}${searchQuery ? `&q=${searchQuery}` : ""}`}
                  className="rounded-lg border border-border/50 px-3 py-1.5 text-sm hover:border-neon/30 hover:text-neon transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border/30 py-16 text-center">
          <Globe className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold">
            {searchQuery
              ? "No matching watchlists"
              : "No public watchlists yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery
              ? "Try a different search term."
              : "Be the first to share a watchlist! Create a watchlist and make it public so others can discover it."}
          </p>
        </div>
      )}
    </div>
  );
}
