import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewsCard } from "@/components/news/news-card";

export interface NewsTabProps {
  modelNews: Record<string, unknown>[];
}

export function NewsTab({ modelNews }: NewsTabProps) {
  if (modelNews.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No news linked to this model yet. News is automatically linked during data sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  const socialItems = modelNews.filter((n) =>
    ["x-twitter", "provider-blog"].includes(n.source as string)
  );
  const researchItems = modelNews.filter((n) =>
    ["arxiv", "hf-papers"].includes(n.source as string)
  );
  const benchmarkItems = modelNews.filter((n) =>
    ["artificial-analysis", "open-llm-leaderboard"].includes(n.source as string)
  );
  const otherItems = modelNews.filter(
    (n) =>
      !["x-twitter", "provider-blog", "arxiv", "hf-papers", "artificial-analysis", "open-llm-leaderboard"].includes(
        n.source as string
      )
  );

  return (
    <div className="space-y-4">
      {socialItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            Social & Blog Posts
            <Badge variant="secondary" className="text-[10px]">{socialItems.length}</Badge>
          </h3>
          <div className="space-y-3">
            {socialItems.map((item) => (
              <NewsCard key={item.id as string} item={item} />
            ))}
          </div>
        </div>
      )}
      {benchmarkItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            Benchmarks & Rankings
            <Badge variant="secondary" className="text-[10px]">{benchmarkItems.length}</Badge>
          </h3>
          <div className="space-y-3">
            {benchmarkItems.map((item) => (
              <NewsCard key={item.id as string} item={item} />
            ))}
          </div>
        </div>
      )}
      {researchItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            Research Papers
            <Badge variant="secondary" className="text-[10px]">{researchItems.length}</Badge>
          </h3>
          <div className="space-y-3">
            {researchItems.map((item) => (
              <NewsCard key={item.id as string} item={item} />
            ))}
          </div>
        </div>
      )}
      {otherItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Other</h3>
          <div className="space-y-3">
            {otherItems.map((item) => (
              <NewsCard key={item.id as string} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
