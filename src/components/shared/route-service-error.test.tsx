import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RouteServiceError from "./route-service-error";
import { SERVICE_STATUS_URL } from "./service-interruption";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("service interruption recovery", () => {
  it("shows useful recovery guidance without exposing the thrown error", () => {
    render(<RouteServiceError error={new Error("private upstream connection details")} retry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Temporarily unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/check its status before submitting it again/)).toBeInTheDocument();
    expect(screen.queryByText(/private upstream/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Service status" })).toHaveAttribute("href", SERVICE_STATUS_URL);
  });

  it("uses the re-fetching retry action instead of only resetting the boundary", () => {
    const retry = vi.fn();
    const reset = vi.fn();
    render(<RouteServiceError error={null} retry={retry} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try loading again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });

  it("supports a legacy reset callback and non-Error thrown values", () => {
    const reset = vi.fn();
    render(<RouteServiceError error={{ message: "sensitive", digest: "sensitive" }} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try loading again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.queryByText(/sensitive/)).not.toBeInTheDocument();
  });
});
