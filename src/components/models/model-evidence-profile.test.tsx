import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelCatalogCoverage } from "./model-catalog-coverage";
import { ModelEvidenceProfileCard } from "./model-evidence-profile";

describe("model evidence presentation", () => {
  it("explains the difference between tracked artifacts and ranked profiles", () => {
    render(
      <ModelCatalogCoverage
        trackedArtifacts={1_827}
        canonicalProfiles={1_389}
        rankedProfiles={549}
        technicalProfiles={481}
      />
    );

    expect(screen.getByText("1,827")).toBeInTheDocument();
    expect(screen.getByText("1,389")).toBeInTheDocument();
    expect(screen.getByText("549")).toBeInTheDocument();
    expect(screen.getByText(/not automatically a distinct rankable model/i)).toBeInTheDocument();
  });

  it("renders coverage dimensions, research facts, gaps, and attribution", () => {
    render(
      <ModelEvidenceProfileCard
        profile={{
          score: 73,
          level: "Developing evidence",
          knownSignals: 16,
          totalSignals: 22,
          missing: ["verified pricing"],
          dimensions: [
            {
              key: "profile",
              label: "Technical profile",
              score: 80,
              known: 4,
              total: 5,
            },
          ],
        }}
        evidence={[
          {
            id: "evidence-1",
            model_id: "model-1",
            source: "epoch-ai",
            source_record_id: "glm-5-3:zai",
            source_name: "GLM-5.3",
            source_url: "https://z.ai/blog/glm-5.3",
            publication_date: "2026-08-14",
            parameter_count: 744_000_000_000,
            training_compute_flop: 1.2e24,
            training_dataset_size: 28_500_000_000_000,
            base_model: "GLM-5.2",
            accessibility: "API access",
            is_open_weights: false,
            confidence: "Confident",
            abstract: "Research evidence",
            source_last_modified_at: "2026-08-25T14:15:11.000Z",
            metadata: {},
            observed_at: "2026-08-25T15:00:00.000Z",
            created_at: "2026-08-25T15:00:00.000Z",
            updated_at: "2026-08-25T15:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByLabelText("73% evidence coverage")).toBeInTheDocument();
    expect(screen.getByText("744B")).toBeInTheDocument();
    expect(screen.getByText("1.2e24 FLOP")).toBeInTheDocument();
    expect(screen.getByText("verified pricing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /epoch ai/i })).toHaveAttribute(
      "href",
      "https://z.ai/blog/glm-5.3"
    );
    expect(screen.getByText(/used under CC BY with attribution/i)).toBeInTheDocument();
  });
});
