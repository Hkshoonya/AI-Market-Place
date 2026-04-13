import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /indexnow-key", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when IndexNow is not configured", async () => {
    const response = GET();

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("not configured");
  });

  it("returns the configured key as plain text", async () => {
    vi.stubEnv("INDEXNOW_KEY", "indexnow-test-key");

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("indexnow-test-key");
  });
});
