import { describe, expect, it } from "vitest";

import {
  appendWorkspaceEvent,
  createWorkspaceEvent,
  createWorkspaceSession,
  parseWorkspaceState,
} from "./session";

describe("workspace session helpers", () => {
  it("creates a deploy workspace session with a starter event", () => {
    const session = createWorkspaceSession({
      model: "GLM-5",
      modelSlug: "z-ai-glm-5",
      provider: "GLM Coding Plan",
      action: "Subscribe",
      suggestedPack: "Builder Pack",
      suggestedAmount: 40,
    });

    expect(session.model).toBe("GLM-5");
    expect(session.suggestedPack).toBe("Builder Pack");
    expect(session.events).toHaveLength(1);
    expect(session.events[0]?.title).toBe("Workspace started");
  });

  it("appends history without mutating prior events", () => {
    const session = createWorkspaceSession({ model: "MiniMax M2.7" });
    const next = appendWorkspaceEvent(
      session,
      createWorkspaceEvent("Wallet opened", "User moved to wallet funding step.")
    );

    expect(session.events).toHaveLength(1);
    expect(next.events).toHaveLength(2);
    expect(next.events[1]?.title).toBe("Wallet opened");
  });

  it("parses persisted workspace state safely", () => {
    expect(
      parseWorkspaceState(
        JSON.stringify({
          open: true,
          minimized: false,
          session: createWorkspaceSession({ model: "Claude Sonnet 4.6" }),
        })
      )
    ).toEqual(
      expect.objectContaining({
        open: true,
        minimized: false,
      })
    );

    expect(parseWorkspaceState("not-json")).toBeNull();
  });
});
