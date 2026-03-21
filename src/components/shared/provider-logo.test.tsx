import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderLogo } from "./provider-logo";

describe("ProviderLogo", () => {
  it("exposes the provider name as the accessible label when only the initial is shown", () => {
    render(<ProviderLogo provider="OpenAI" />);

    expect(screen.getByRole("img", { name: "OpenAI" })).toBeInTheDocument();
  });

  it("exposes the provider name with context when the label is shown", () => {
    render(<ProviderLogo provider="Anthropic" showName />);

    expect(screen.getByRole("img", { name: "Anthropic provider" })).toBeInTheDocument();
  });
});
