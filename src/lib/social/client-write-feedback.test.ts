import { describe, expect, it } from "vitest";
import {
  describeSocialWriteFailure,
  parseSocialWriteFailure,
} from "./client-write-feedback";

describe("client-write-feedback", () => {
  it("maps unauthorized writes to a session-expired message", () => {
    expect(
      describeSocialWriteFailure({
        action: "thread",
        status: 401,
      })
    ).toMatchObject({
      category: "unauthorized",
      message: expect.stringContaining("session is missing or expired"),
    });
  });

  it("maps forbidden writes to an origin-blocked message", () => {
    expect(
      describeSocialWriteFailure({
        action: "reply",
        status: 403,
      })
    ).toMatchObject({
      category: "forbidden",
      message: expect.stringContaining("blocked before it reached Commons"),
    });
  });

  it("uses server validation details for bad requests", () => {
    expect(
      describeSocialWriteFailure({
        action: "thread",
        status: 400,
        detail: "Thread content is required",
      })
    ).toMatchObject({
      category: "validation",
      message: "Thread content is required",
    });
  });

  it("falls back to a generic server message when no detail is present", () => {
    expect(
      describeSocialWriteFailure({
        action: "reply",
        status: 500,
      })
    ).toMatchObject({
      category: "server",
      message: expect.stringContaining("could not publish this reply"),
    });
  });

  it("parses JSON error payloads from failed responses", async () => {
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

    await expect(parseSocialWriteFailure(response, "reply")).resolves.toMatchObject({
      category: "unauthorized",
      detail: "Unauthorized",
    });
  });
});
