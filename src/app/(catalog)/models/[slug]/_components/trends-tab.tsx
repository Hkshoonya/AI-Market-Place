import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QualityTrend } from "@/components/charts/quality-trend";
import { DownloadsTrend } from "@/components/charts/downloads-trend";

export interface Snapshot {
  snapshot_date: string;
  quality_score: number | null;
  hf_downloads: number | null;
  hf_likes: number | null;
  overall_rank: number | null;
}

export interface TrendsTabProps {
  snapshots: Snapshot[];
}

export function TrendsTab({ snapshots }: TrendsTabProps) {
  if (snapshots.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">No historical trend data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Quality Score Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <QualityTrend
            snapshots={snapshots.map((s) => ({
              snapshot_date: s.snapshot_date,
              quality_score: s.quality_score,
            }))}
          />
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Downloads Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <DownloadsTrend
            snapshots={snapshots.map((s) => ({
              snapshot_date: s.snapshot_date,
              hf_downloads: s.hf_downloads,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
