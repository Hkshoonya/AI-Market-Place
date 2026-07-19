import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyWorkspaceState,
  createWorkspaceSession,
  touchWorkspaceState,
  WORKSPACE_STORAGE_KEY,
} from "@/lib/workspace/session";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: null }),
}));

function WorkspaceProbe() {
  const workspace = useWorkspace();
  return <p>{workspace.session?.model ?? "Empty workspace"}</p>;
}

describe("WorkspaceProvider hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a stable empty state, then restores the persisted workspace after hydration", async () => {
    const savedState = touchWorkspaceState({
      ...createEmptyWorkspaceState(),
      open: true,
      session: createWorkspaceSession({ model: "Saved model", modelSlug: "saved-model" }),
    });
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(savedState));

    const serverMarkup = renderToString(
      <WorkspaceProvider>
        <WorkspaceProbe />
      </WorkspaceProvider>
    );

    expect(serverMarkup).toContain("Empty workspace");
    expect(serverMarkup).not.toContain("Saved model");

    render(
      <WorkspaceProvider>
        <WorkspaceProbe />
      </WorkspaceProvider>
    );

    expect(await screen.findByText("Saved model")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toContain("Saved model");
    });
  });
});
