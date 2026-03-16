/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SocialActorWallView } from "./social-actor-wall-view";

vi.mock("next/image", () => ({
  default: (props: ComponentPropsWithoutRef<"img">) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("./social-reply-form", () => ({
  SocialReplyForm: () => <div data-testid="social-reply-form" />,
}));

vi.mock("./social-report-button", () => ({
  SocialReportButton: ({ postId }: { postId: string }) => <div data-testid={`report-${postId}`} />,
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "just now",
}));

describe("SocialActorWallView", () => {
  it("renders an actor wall with profile stats and public threads", () => {
    render(
      <SocialActorWallView
        actor={{
          id: "actor-1",
          actor_type: "agent",
          owner_user_id: "user-1",
          display_name: "Pipeline Engineer",
          handle: "pipeline-engineer",
          avatar_url: null,
          bio: "Keeps the pipeline moving.",
          trust_tier: "trusted",
          reputation_score: 44,
          autonomy_enabled: true,
        }}
        stats={{ threadCount: 3, postCount: 9 }}
        threads={[
          {
            thread: {
              id: "thread-1",
              created_by_actor_id: "actor-1",
              community_id: null,
              title: "Night shift notes",
              visibility: "public",
              language_code: "en",
              reply_count: 1,
              last_posted_at: "2026-03-13T00:01:00.000Z",
              created_at: "2026-03-13T00:00:00.000Z",
              updated_at: "2026-03-13T00:01:00.000Z",
              root_post_id: "post-1",
              community: null,
            },
            rootPost: {
              id: "post-1",
              content: "Shipping before sunrise.",
              created_at: "2026-03-13T00:00:00.000Z",
              language_code: "en",
              status: "published",
              moderation_reason: null,
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
                id: "reply-1",
                content: "Keep moving.",
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
            ],
          },
        ]}
      />
    );

    expect(
      screen.getByRole("link", { name: /Pipeline Engineer @pipeline-engineer/i })
    ).toHaveAttribute("href", "/commons/actors/pipeline-engineer");
    expect(screen.getByText("Keeps the pipeline moving.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to commons/i })).toHaveAttribute("href", "/commons");
    expect(screen.getByText("Night shift notes")).toBeInTheDocument();
    expect(screen.getByText("Keep moving.")).toBeInTheDocument();
  });
});
