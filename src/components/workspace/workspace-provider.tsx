"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  appendWorkspaceEvent,
  createWorkspaceEvent,
  createWorkspaceSession,
  parseWorkspaceState,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceSession,
  type WorkspaceState,
} from "@/lib/workspace/session";

interface OpenWorkspaceInput {
  model?: string | null;
  modelSlug?: string | null;
  provider?: string | null;
  action?: string | null;
  nextUrl?: string | null;
  suggestedPack?: string | null;
  suggestedAmount?: number | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  openWorkspace: (input: OpenWorkspaceInput) => void;
  minimizeWorkspace: () => void;
  expandWorkspace: () => void;
  closeWorkspace: () => void;
  addWorkspaceEvent: (title: string, detail: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    open: false,
    minimized: false,
    session: null,
  });

  useEffect(() => {
    const stored = parseWorkspaceState(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
    if (stored) setState(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const openWorkspace = useCallback((input: OpenWorkspaceInput) => {
    setState((current) => {
      const session =
        current.session &&
        current.session.modelSlug &&
        input.modelSlug &&
        current.session.modelSlug === input.modelSlug
          ? appendWorkspaceEvent(
              current.session,
              createWorkspaceEvent(
                "Workspace resumed",
                input.model
                  ? `Returned to the saved deploy workspace for ${input.model}.`
                  : "Returned to the saved deploy workspace."
              )
            )
          : createWorkspaceSession({
              model: input.model,
              modelSlug: input.modelSlug,
              provider: input.provider,
              action: input.action,
              nextUrl: input.nextUrl,
              suggestedPack: input.suggestedPack,
              suggestedAmount: input.suggestedAmount,
            });

      return {
        open: true,
        minimized: false,
        session,
      };
    });
  }, []);

  const minimizeWorkspace = useCallback(() => {
    setState((current) => ({ ...current, open: true, minimized: true }));
  }, []);

  const expandWorkspace = useCallback(() => {
    setState((current) => ({ ...current, open: true, minimized: false }));
  }, []);

  const closeWorkspace = useCallback(() => {
    setState((current) => ({ ...current, open: false, minimized: false }));
  }, []);

  const addWorkspaceEvent = useCallback((title: string, detail: string) => {
    setState((current) => {
      if (!current.session) return current;
      return {
        ...current,
        session: appendWorkspaceEvent(current.session, createWorkspaceEvent(title, detail)),
      };
    });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      openWorkspace,
      minimizeWorkspace,
      expandWorkspace,
      closeWorkspace,
      addWorkspaceEvent,
    }),
    [state, openWorkspace, minimizeWorkspace, expandWorkspace, closeWorkspace, addWorkspaceEvent]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}
