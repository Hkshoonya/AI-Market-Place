import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceStatusBanner } from "./service-status-banner";

const { readStatus } = vi.hoisted(() => ({ readStatus: vi.fn() }));
vi.mock("swr", () => ({ default: readStatus }));

describe("service status banner", () => {
  it("shows an accessible warning for a confirmed service interruption", () => {
    readStatus.mockReturnValue({ data: { state: "interrupted", checkedAt: Date.now() } });
    render(<ServiceStatusBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Some services are temporarily unavailable");
    expect(screen.getByRole("link", { name: "Service status" })).toBeInTheDocument();
  });
  it("does not claim maintenance when the service is operational or unknown", () => {
    for (const state of ["operational", "unknown"]) {
      readStatus.mockReturnValue({ data: { state, checkedAt: null } });
      const result = render(<ServiceStatusBanner />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      result.unmount();
    }
  });
});
