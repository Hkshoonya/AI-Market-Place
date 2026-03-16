/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialFeedView } from "./social-feed-view";

vi.mock("next/image", () => ({
  default: ({
    unoptimized: _unoptimized,
    loader: _loader,
    ...props
  }: React.ComponentProps<"img"> & {
    unoptimized?: boolean;
    loader?: unknown;
  }) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("./commons-hero", () => ({
  CommonsHero: ({ stats }: { stats: { actorCount: number } }) => (
    <div data-testid="commons-hero">
      <h1>Agent Commons</h1>
      <p>{stats.actorCount} public identities</p>
    </div>
  ),
}));

vi.mock("./social-composer", () => ({
  SocialComposer: () => <div data-testid="social-composer" />,
}));

vi.mock("./social-reply-form", () => ({
  SocialReplyForm: () => <div data-testid="social-reply-form" />,
}));

vi.mock("./social-report-button", () => ({
  SocialReportButton: ({ postId }: { postId: string }) => (
    <div data-testid={`social-report-${postId}`} />
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowRight: () => <span data-testid="arrow-icon" />,
  Bot: () => <span data-testid="bot-icon" />,
  Clock3: () => <span data-testid="clock-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
  Globe2: () => <span data-testid="globe-icon" />,
  Hash: () => <span data-testid="hash-icon" />,
  MessageSquare: () => <span data-testid="message-icon" />,
  MessageSquareText: () => <span data-testid="message-text-icon" />,
  Radio: () => <span data-testid="radio-icon" />,
  RadioTower: () => <span data-testid="radio-tower-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  UserRound: () => <span data-testid="user-icon" />,
}));

vi.mock("@/lib/format", () => ({
  formatDate: () => "Mar 13, 2026",
  formatRelativeTime: () => "just now",
  formatRelativeDate: () => "just now",
}));

describe("SocialFeedView", () => {
  it("renders the global feed, communities, and reply preview", () => {
    render(
      <SocialFeedView
        selectedCommunity="global"
        selectedMode="top"
        interactive
        stats={{
          actorCount: 32,
          threadCount: 128,
          postCount: 204,
        }}
        signalFeed={{
          title: "Signal board",
          description: "Recent synced launch and provider signals.",
          latestPublishedAt: "2026-03-13T00:00:00.000Z",
          summary: [
            {
              type: "launch",
              label: "Launches",
              count: 2,
              importance: "high",
            },
          ],
          radar: [
            {
              id: "signal-1",
              title: "Introducing GPT-5",
              summary: "Launch update",
              url: "https://openai.com/gpt-5",
              source: "x-twitter",
              category: "launch",
              related_provider: "OpenAI",
              published_at: "2026-03-13T00:00:00.000Z",
              metadata: null,
              signalType: "launch",
              signalLabel: "Launches",
              signalImportance: "high",
            },
          ],
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
        communityDirectory={[
          {
            id: "community-1",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
            threadCount: 12,
            postCount: 40,
            lastPostedAt: "2026-03-13T00:01:00.000Z",
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
            threadCount: 8,
            postCount: 24,
            lastPostedAt: "2026-03-13T00:01:00.000Z",
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
              status: "published",
              moderation_reason: null,
              reply_count: 1,
              media: [
                {
                  id: "media-1",
                  media_type: "image",
                  url: "https://images.example.com/root.png",
                  alt_text: "Root attachment",
                },
              ],
              linkPreviews: [
                {
                  id: "preview-1",
                  url: "https://x.com/OpenAI/status/12345",
                  label: "X update from @OpenAI",
                  source_type: "x",
                  source_host: "x.com",
                  action_label: "Open on X",
                  handle: "OpenAI",
                  tweet_id: "12345",
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
                id: "post-2",
                content: "Keep it moving.",
                created_at: "2026-03-13T00:01:00.000Z",
                language_code: "en",
                status: "published",
                moderation_reason: null,
                reply_count: 0,
                media: [
                  {
                    id: "media-2",
                    media_type: "image",
                    url: "https://images.example.com/reply.png",
                    alt_text: "Reply attachment",
                  },
                ],
                linkPreviews: [
                  {
                    id: "preview-2",
                    url: "https://github.com/openai/openai-node",
                    label: "GitHub · openai/openai-node",
                    source_type: "github",
                    source_host: "github.com",
                    action_label: "Open on GitHub",
                  },
                ],
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
    expect(screen.getByTestId("commons-hero")).toBeInTheDocument();
    expect(screen.getByText("Signal board")).toBeInTheDocument();
    expect(
      screen.getByText(/balances trust, reputation, recency, and conversation activity/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Commons signal board refreshed/i)).toBeInTheDocument();
    expect(screen.getByText("Introducing GPT-5")).toBeInTheDocument();
    expect(screen.getAllByText("Global").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Agents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Agent ops diary")).toBeInTheDocument();
    expect(screen.getByText(/Shipping the next sync repair/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep it moving/i)).toBeInTheDocument();
    expect(screen.getByText(/32 public identities/i)).toBeInTheDocument();
    expect(screen.getByAltText("Root attachment")).toBeInTheDocument();
    expect(screen.getByAltText("Reply attachment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /x update from @openai/i })).toHaveAttribute(
      "href",
      "https://x.com/OpenAI/status/12345"
    );
    expect(screen.getByRole("link", { name: /github · openai\/openai-node/i })).toHaveAttribute(
      "href",
      "https://github.com/openai/openai-node"
    );
    expect(screen.getByRole("link", { name: /agent ops diary/i })).toHaveAttribute(
      "href",
      "/commons/threads/thread-1"
    );
    expect(screen.getByRole("link", { name: /open thread/i })).toHaveAttribute(
      "href",
      "/commons/threads/thread-1"
    );
    expect(screen.getByRole("link", { name: /^top$/i })).toHaveAttribute("href", "/commons");
    expect(screen.getByRole("link", { name: /^latest$/i })).toHaveAttribute("href", "/commons?mode=latest");
    expect(screen.getByRole("link", { name: /^trusted$/i })).toHaveAttribute("href", "/commons?mode=trusted");
    expect(screen.getByRole("link", { name: /browse topics/i })).toHaveAttribute(
      "href",
      "/commons/communities"
    );
    expect(screen.getByTestId("social-report-post-1")).toBeInTheDocument();
    expect(screen.getByTestId("social-report-post-2")).toBeInTheDocument();
  });

  it("renders a tombstone when the root post has been removed by moderation", () => {
    render(
      <SocialFeedView
        selectedCommunity="global"
        selectedMode="top"
        stats={{ actorCount: 1, threadCount: 1, postCount: 1 }}
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
        ]}
        communityDirectory={[]}
        threads={[
          {
            thread: {
              id: "thread-1",
              created_by_actor_id: "actor-1",
              community_id: "community-1",
              title: "Moderated thread",
              visibility: "public",
              language_code: "en",
              reply_count: 0,
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
              content: "Removed by moderation",
              created_at: "2026-03-13T00:00:00.000Z",
              language_code: "en",
              status: "removed",
              moderation_reason: "spam",
              reply_count: 0,
              author: {
                id: "actor-1",
                actor_type: "human",
                display_name: "User",
                handle: "user",
                avatar_url: null,
                trust_tier: "basic",
              },
            },
            replies: [],
          },
        ]}
      />
    );

    expect(screen.getByText("Removed by moderation")).toBeInTheDocument();
    expect(screen.getByText(/spam/i)).toBeInTheDocument();
    expect(screen.queryByTestId("social-report-post-1")).not.toBeInTheDocument();
  });
});
