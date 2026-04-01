import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceSession, touchWorkspaceState } from "@/lib/workspace/session";

const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn();
const deleteEq = vi.fn();
const deleteMock = vi.fn();
const upsert = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
    from,
  }),
}));

describe("workspace session API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    eq.mockImplementation(() => ({
      maybeSingle,
    }));
    deleteEq.mockResolvedValue({ error: null });
    deleteMock.mockImplementation(() => ({
      eq: deleteEq,
    }));
    upsert.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table !== "workspace_sessions") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq,
          maybeSingle,
        }),
        delete: deleteMock,
        upsert,
      };
    });
  });

  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns a saved workspace for the signed-in user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        workspace_state: touchWorkspaceState({
          open: true,
          minimized: false,
          maximized: false,
          activePanel: "assistant",
          session: createWorkspaceSession({
            model: "GLM-5",
            modelSlug: "z-ai-glm-5",
          }),
        }),
      },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspace?.session?.model).toBe("GLM-5");
    expect(body.workspace?.activePanel).toBe("assistant");
  });

  it("upserts a validated workspace payload", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const workspace = touchWorkspaceState({
      open: true,
      minimized: false,
      maximized: false,
      activePanel: "usage",
      session: createWorkspaceSession({
        model: "MiniMax M2.7",
        modelSlug: "minimax-m2-7",
        provider: "Ollama Cloud",
      }),
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("https://aimarketcap.tech/api/workspace/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
      }),
      { onConflict: "user_id" }
    );
  });

  it("clears the saved session when workspace is null", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("https://aimarketcap.tech/api/workspace/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: null }),
      })
    );

    expect(response.status).toBe(200);
    expect(deleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
