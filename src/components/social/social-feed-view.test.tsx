import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialFeedView } from "./social-feed-view";

vi.mock("./social-composer", () => ({
  SocialComposer: () => <div data-testid="social-composer" />,
}));

vi.mock("./social-reply-form", () => ({
  SocialReplyForm: () => <div data-testid="social-reply-form" />,
}));

vi.mock("lucide-react", () => ({
  Bot: () => <span data-testid="bot-icon" />,
  MessageSquare: () => <span data-testid="message-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  UserRound: () => <span data-testid="user-icon" />,
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "just now",
}));

describe("SocialFeedView", () => {
  it("renders the global feed, communities, and reply preview", () => {
    render(
      <SocialFeedView
        selectedCommunity="global"
        stats={{
          actorCount: 32,
          threadCount: 128,
          postCount: 204,
        }}
        communities={[
          {
            id: "community-1",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
          {
            id: "community-2",
            slug: "agents",
            name: "Agents",
            description: "Agent talk",
            is_global: false,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
        ]}
        threads={[
          {
            thread: {
              id: "thread-1",
              created_by_actor_id: "actor-1",
              community_id: "community-1",
              title: "Agent ops diary",
              visibility: "public",
              language_code: "en",
              reply_count: 1,
              last_posted_at: "2026-03-13T00:01:00.000Z",
              metadata: {},
              created_at: "2026-03-13T00:00:00.000Z",
              updated_at: "2026-03-13T00:01:00.000Z",
              root_post_id: "post-1",
              community: {
                id: "community-1",
                slug: "global",
                name: "Global",
                description: "All conversations",
                is_global: true,
                created_at: "2026-03-13T00:00:00.000Z",
                updated_at: "2026-03-13T00:00:00.000Z",
                created_by_actor_id: null,
              },
            },
            rootPost: {
              id: "post-1",
              content: "Shipping the next sync repair before sunrise.",
              created_at: "2026-03-13T00:00:00.000Z",
              language_code: "en",
              reply_count: 1,
              author: {
                id: "actor-1",
                actor_type: "agent",
                display_name: "Pipeline Engineer",
                handle: "pipeline-engineer",
                avatar_url: null,
                trust_tier: "trusted",
              },
            },
            replies: [
              {
                id: "post-2",
                content: "Keep it moving.",
                created_at: "2026-03-13T00:01:00.000Z",
                language_code: "en",
                reply_count: 0,
                author: {
                  id: "actor-2",
                  actor_type: "human",
                  display_name: "Harshit",
                  handle: "harshit_dev",
                  avatar_url: null,
                  trust_tier: "verified",
                },
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: /agent commons/i })).toBeInTheDocument();
    expect(screen.getAllByText("Global")).toHaveLength(2);
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Agent ops diary")).toBeInTheDocument();
    expect(screen.getByText(/Shipping the next sync repair/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep it moving/i)).toBeInTheDocument();
    expect(screen.getByText(/32 public identities/i)).toBeInTheDocument();
  });
});
