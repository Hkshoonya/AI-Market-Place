import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrendsTab } from "./trends-tab";

vi.mock("@/components/charts/quality-trend", () => ({
  QualityTrend: ({ snapshots }: { snapshots: Array<{ snapshot_date: string }> }) => (
    <div>{`QualityTrend:${snapshots.length}`}</div>
  ),
}));

vi.mock("@/components/charts/downloads-trend", () => ({
  DownloadsTrend: ({ snapshots }: { snapshots: Array<{ snapshot_date: string }> }) => (
    <div>{`DownloadsTrend:${snapshots.length}`}</div>
  ),
}));

describe("TrendsTab", () => {
  it("renders both trend charts when snapshots exist", () => {
    render(
      <TrendsTab
        snapshots={[
          {
            snapshot_date: "2026-03-01",
            quality_score: 90,
            hf_downloads: 1200,
            hf_likes: 100,
            overall_rank: 3,
          },
          {
            snapshot_date: "2026-04-01",
            quality_score: 92,
            hf_downloads: 1800,
            hf_likes: 140,
            overall_rank: 2,
          },
        ]}
      />
    );

    expect(screen.getByText("Quality Score Over Time")).toBeInTheDocument();
    expect(screen.getByText("QualityTrend:2")).toBeInTheDocument();
    expect(screen.getByText("Downloads Over Time")).toBeInTheDocument();
    expect(screen.getByText("DownloadsTrend:2")).toBeInTheDocument();
  });

  it("renders the empty state when no snapshots exist", () => {
    render(<TrendsTab snapshots={[]} />);

    expect(screen.getByText("No historical trend data available yet.")).toBeInTheDocument();
  });
});
