import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDate } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "News & Updates",
  description: "Latest AI model updates, new launches, and industry news.",
};

export const revalidate = 1800;

export default async function NewsPage() {
  const supabase = await createClient();

  const { data: updatesRaw } = await supabase
    .from("model_updates")
    .select("*, models(slug, name, provider)")
    .order("published_at", { ascending: false })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates = (updatesRaw as any[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Newspaper className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">News & Updates</h1>
      </div>

      {updates.length > 0 ? (
        <div className="space-y-4">
          {updates.map((update) => (
            <Card key={update.id} className="border-border/50 bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[11px]">
                        {update.update_type?.replace(/_/g, " ") ?? "update"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(update.published_at)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold">{update.title}</h3>
                    {update.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {update.description}
                      </p>
                    )}
                    {update.models && (
                      <Link
                        href={`/models/${update.models.slug}`}
                        className="mt-2 inline-block text-xs text-neon hover:underline"
                      >
                        {update.models.name} by {update.models.provider}
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No updates yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
