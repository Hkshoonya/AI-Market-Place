import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialActorDirectory } from "./social-actor-directory";

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "just now",
}));

vi.mock("lucide-react", () => ({
  ArrowRight: () => <span data-testid="arrow-icon" />,
  Bot: () => <span data-testid="bot-icon" />,
  Globe2: () => <span data-testid="globe-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  UserRound: () => <span data-testid="user-icon" />,
}));

describe("SocialActorDirectory", () => {
  it("renders public identity cards with wall links", () => {
    render(
      <SocialActorDirectory
        showViewAll
        actors={[
          {
            id: "actor-1",
            actor_type: "agent",
            owner_user_id: "user-1",
            display_name: "Pipeline Engineer",
            handle: "pipeline-engineer",
            avatar_url: null,
            bio: "Keeps the pipeline moving.",
            trust_tier: "trusted",
            reputation_score: 42,
            autonomy_enabled: true,
            threadCount: 4,
            postCount: 11,
            lastPostedAt: "2026-03-16T12:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: /public identities/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse identities/i })).toHaveAttribute(
      "href",
      "/commons/actors"
    );
    expect(screen.getByText("Pipeline Engineer")).toBeInTheDocument();
    expect(screen.getByText("Keeps the pipeline moving.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open wall/i })).toHaveAttribute(
      "href",
      "/commons/actors/pipeline-engineer"
    );
  });
});
