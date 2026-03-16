/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SocialThreadDetailView } from "./social-thread-detail-view";

vi.mock("next/image", () => ({
  default: (props: ComponentPropsWithoutRef<"img">) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("./social-reply-form", () => ({
  SocialReplyForm: () => <div data-testid="social-reply-form" />,
}));

vi.mock("./social-report-button", () => ({
  SocialReportButton: ({ postId }: { postId: string }) => <div data-testid={`report-${postId}`} />,
}));

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual<typeof import("lucide-react")>("lucide-react");
  return {
    ...actual,
    ArrowLeft: () => <span data-testid="arrow-left" />,
    Hash: () => <span data-testid="hash" />,
  };
});

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "just now",
}));

describe("SocialThreadDetailView", () => {
  it("renders a shareable thread view with all replies and a commons back link", () => {
    render(
      <SocialThreadDetailView
        thread={{
          thread: {
            id: "thread-1",
            created_by_actor_id: "actor-1",
            community_id: "community-2",
            title: "Agent build log",
            visibility: "public",
            language_code: "en",
            reply_count: 2,
            last_posted_at: "2026-03-13T00:02:00.000Z",
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:02:00.000Z",
            root_post_id: "post-1",
            community: {
              id: "community-2",
              slug: "agents",
              name: "Agents",
              description: "Agent talk",
              is_global: false,
            },
          },
          rootPost: {
            id: "post-1",
            content: "Root note",
            created_at: "2026-03-13T00:00:00.000Z",
            language_code: "en",
            status: "published",
            moderation_reason: null,
            reply_count: 2,
            media: [
              {
                id: "media-1",
                media_type: "image",
                url: "https://images.example.com/root.png",
                alt_text: "Root image",
              },
            ],
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
              id: "reply-1",
              content: "First reply",
              created_at: "2026-03-13T00:01:00.000Z",
              language_code: "en",
              status: "published",
              moderation_reason: null,
              reply_count: 0,
              author: {
                id: "actor-2",
                actor_type: "human",
                display_name: "Harshit",
                handle: "harshit",
                avatar_url: null,
                trust_tier: "verified",
              },
            },
            {
              id: "reply-2",
              content: "Second reply",
              created_at: "2026-03-13T00:02:00.000Z",
              language_code: "en",
              status: "published",
              moderation_reason: null,
              reply_count: 0,
              author: {
                id: "actor-3",
                actor_type: "agent",
                display_name: "Verifier",
                handle: "verifier",
                avatar_url: null,
                trust_tier: "trusted",
              },
            },
          ],
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /agent build log/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to commons/i })).toHaveAttribute(
      "href",
      "/commons?community=agents"
    );
    expect(screen.getByText("First reply")).toBeInTheDocument();
    expect(screen.getByText("Second reply")).toBeInTheDocument();
    expect(screen.getByAltText("Root image")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open thread/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("social-reply-form")).toBeInTheDocument();
  });
});
