import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelHeader } from "./model-header";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/models/model-actions", () => ({
  ModelActions: () => <div data-testid="model-actions" />,
}));

vi.mock("@/components/models/share-model", () => ({
  ShareModel: () => <div data-testid="share-model" />,
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: () => <div data-testid="provider-logo" />,
}));

vi.mock("@/components/shared/data-freshness-badge", () => ({
  DataFreshnessBadge: ({
    label,
    timestamp,
    detail,
  }: {
    label: string;
    timestamp: string | null | undefined;
    detail?: string | null;
  }) => (
    <div
      data-testid="freshness-badge"
      data-label={label}
      data-timestamp={timestamp ?? ""}
      data-detail={detail ?? ""}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  ExternalLink: () => <svg />,
  Globe: () => <svg />,
  Newspaper: () => <svg />,
}));

describe("ModelHeader", () => {
  it("deep-links View Updates to the news tab", () => {
    render(
      <ModelHeader
        name="Test Model"
        provider="OpenAI"
        description="A test model"
        overall_rank={1}
        is_open_weights={false}
        website_url="https://example.com"
        slug="test-model"
        id="model-1"
        catConfig={undefined}
        hasNews
      />
    );

    expect(screen.getByRole("link", { name: /view updates/i })).toHaveAttribute(
      "href",
      "/models/test-model?tab=news#model-tabs"
    );
  });

  it("surfaces a freshness badge when updates exist", () => {
    render(
      <ModelHeader
        name="Test Model"
        provider="OpenAI"
        description="A test model"
        overall_rank={1}
        is_open_weights={false}
        website_url="https://example.com"
        slug="test-model"
        id="model-1"
        catConfig={undefined}
        latestUpdateAt="2026-03-20T12:00:00.000Z"
      />
    );

    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-label",
      "Model updates refreshed"
    );
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-timestamp",
      "2026-03-20T12:00:00.000Z"
    );
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-detail",
      "news + changelog"
    );
  });

  it("uses the verified external deploy path when one exists", () => {
    render(
      <ModelHeader
        name="Test Model"
        provider="OpenAI"
        description="A test model"
        overall_rank={1}
        is_open_weights={false}
        website_url="https://example.com"
        slug="test-model"
        id="model-1"
        catConfig={undefined}
        deployActionLabel="Get API Access"
        deployActionHref="https://platform.example.com/test-model"
        deployActionExternal
      />
    );

    expect(screen.getByRole("link", { name: /get api access/i })).toHaveAttribute(
      "href",
      "https://platform.example.com/test-model"
    );
  });

  it("marks sponsored deploy links with SEO-safe rel values", () => {
    render(
      <ModelHeader
        name="Test Model"
        provider="OpenAI"
        description="A test model"
        overall_rank={1}
        is_open_weights={false}
        website_url="https://example.com"
        slug="test-model"
        id="model-1"
        catConfig={undefined}
        deployActionLabel="Deploy"
        deployActionHref="https://partner.example.com/deploy"
        deployActionExternal
        deployActionSponsored
      />
    );

    expect(screen.getByRole("link", { name: /deploy/i })).toHaveAttribute(
      "rel",
      "noopener noreferrer sponsored nofollow"
    );
  });
});
