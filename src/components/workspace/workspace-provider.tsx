"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  appendWorkspaceEvent,
  createEmptyWorkspaceState,
  createWorkspaceEvent,
  createWorkspaceSession,
  pickNewerWorkspaceState,
  parseWorkspaceState,
  touchWorkspaceState,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceSession,
  type WorkspaceState,
} from "@/lib/workspace/session";

interface OpenWorkspaceInput {
  model?: string | null;
  modelSlug?: string | null;
  provider?: string | null;
  action?: string | null;
  autoStartDeployment?: boolean | null;
  nextUrl?: string | null;
  conversationId?: string | null;
  sponsored?: boolean | null;
  suggestedPackSlug?: string | null;
  suggestedPack?: string | null;
  suggestedAmount?: number | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  persistenceStatus: "local" | "loading" | "saving" | "saved" | "error";
  openWorkspace: (input: OpenWorkspaceInput) => void;
  minimizeWorkspace: () => void;
  expandWorkspace: () => void;
  maximizeWorkspace: () => void;
  restoreWorkspace: () => void;
  setActivePanel: (panel: WorkspaceState["activePanel"]) => void;
  closeWorkspace: () => void;
  addWorkspaceEvent: (title: string, detail: string, type?: "system" | "user") => void;
  updateWorkspaceSession: (patch: Partial<WorkspaceSession>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const autoStartInFlightRef = useRef(false);
  const [state, setState] = useState<WorkspaceState>(() => {
    if (typeof window === "undefined") {
      return createEmptyWorkspaceState();
    }

    return parseWorkspaceState(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)) ?? createEmptyWorkspaceState();
  });
  const [persistenceStatus, setPersistenceStatus] = useState<
    "local" | "loading" | "saving" | "saved" | "error"
  >("local");
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const saveReadyRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!user?.id) {
      lastLoadedUserIdRef.current = null;
      saveReadyRef.current = false;
      setPersistenceStatus("local");
      return;
    }

    let cancelled = false;
    setPersistenceStatus("loading");

    void (async () => {
      try {
        const response = await fetch("/api/workspace/session", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load saved workspace");
        }

        const payload = (await response.json()) as { workspace?: WorkspaceState | null };
        if (cancelled) return;

        setState((current) => pickNewerWorkspaceState(current, payload.workspace ?? null) ?? current);
        lastLoadedUserIdRef.current = user.id;
        saveReadyRef.current = true;
        setPersistenceStatus("saved");
      } catch {
        if (cancelled) return;
        lastLoadedUserIdRef.current = user.id;
        saveReadyRef.current = true;
        setPersistenceStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !saveReadyRef.current || lastLoadedUserIdRef.current !== user.id) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setPersistenceStatus("saving");
        const response = await fetch("/api/workspace/session", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workspace: state.session ? state : null }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to save workspace");
        }

        setPersistenceStatus("saved");
      } catch {
        if (controller.signal.aborted) return;
        setPersistenceStatus("error");
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [state, user?.id]);

  useEffect(() => {
    const session = state.session;
    if (
      !user?.id ||
      !session?.autoStartDeployment ||
      !session.modelSlug ||
      !session.model ||
      autoStartInFlightRef.current
    ) {
      return;
    }

    autoStartInFlightRef.current = true;
    setState((current) => {
      if (!current.session) return current;
      return touchWorkspaceState({
        ...current,
        session: {
          ...current.session,
          autoStartDeployment: false,
        },
      });
    });

    void (async () => {
      try {
        const response = await fetch("/api/workspace/deployment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modelSlug: session.modelSlug,
            modelName: session.model,
            providerName: session.provider,
            conversationId: session.conversationId,
            creditsBudget: session.suggestedAmount,
            monthlyPriceEstimate: session.suggestedAmount,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to create deployment");
        }

        setState((current) => {
          if (!current.session || current.session.modelSlug !== session.modelSlug) {
            return current;
          }

          return touchWorkspaceState({
            ...current,
            activePanel: "usage",
            session: appendWorkspaceEvent(
              {
                ...current.session,
                runtimeId: payload.runtime?.id ?? null,
                runtimeEndpointPath: payload.runtime?.endpointPath ?? null,
                deploymentId: payload.deployment?.id ?? null,
                deploymentEndpointPath: payload.deployment?.endpointPath ?? null,
              },
              createWorkspaceEvent(
                "Deployment created",
                payload.activation?.message ??
                  (session.model
                    ? `Created a deployment for ${session.model}.`
                    : "Created a deployment.")
              )
            ),
          });
        });
      } catch (error) {
        setState((current) => {
          if (!current.session || current.session.modelSlug !== session.modelSlug) {
            return current;
          }

          return touchWorkspaceState({
            ...current,
            session: appendWorkspaceEvent(
              current.session,
              createWorkspaceEvent(
                "Deployment start failed",
                error instanceof Error
                  ? error.message
                  : "AI Market Cap could not start this deployment automatically."
              )
            ),
          });
        });
      } finally {
        autoStartInFlightRef.current = false;
      }
    })();
  }, [state.session, user?.id]);

  const openWorkspace = useCallback((input: OpenWorkspaceInput) => {
    setState((current) => {
      const session =
        current.session &&
        current.session.modelSlug &&
        input.modelSlug &&
        current.session.modelSlug === input.modelSlug
          ? appendWorkspaceEvent(
              {
                ...current.session,
                provider: input.provider ?? current.session.provider,
                action: input.action ?? current.session.action,
                autoStartDeployment:
                  input.autoStartDeployment != null
                    ? Boolean(input.autoStartDeployment)
                    : current.session.autoStartDeployment,
                nextUrl: input.nextUrl ?? current.session.nextUrl,
                sponsored:
                  input.sponsored != null ? Boolean(input.sponsored) : current.session.sponsored,
                suggestedPackSlug:
                  input.suggestedPackSlug ?? current.session.suggestedPackSlug,
                suggestedPack: input.suggestedPack ?? current.session.suggestedPack,
                suggestedAmount: input.suggestedAmount ?? current.session.suggestedAmount,
              },
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
              autoStartDeployment: input.autoStartDeployment,
              nextUrl: input.nextUrl,
              conversationId: input.conversationId,
              sponsored: input.sponsored,
              suggestedPackSlug: input.suggestedPackSlug,
              suggestedPack: input.suggestedPack,
              suggestedAmount: input.suggestedAmount,
            });

      return touchWorkspaceState({
        open: true,
        minimized: false,
        maximized: current.maximized,
        activePanel: current.activePanel,
        session,
      });
    });
  }, []);

  const minimizeWorkspace = useCallback(() => {
    setState((current) => touchWorkspaceState({ ...current, open: true, minimized: true, maximized: false }));
  }, []);

  const expandWorkspace = useCallback(() => {
    setState((current) => touchWorkspaceState({ ...current, open: true, minimized: false }));
  }, []);

  const maximizeWorkspace = useCallback(() => {
    setState((current) =>
      touchWorkspaceState({ ...current, open: true, minimized: false, maximized: true })
    );
  }, []);

  const restoreWorkspace = useCallback(() => {
    setState((current) =>
      touchWorkspaceState({ ...current, open: true, minimized: false, maximized: false })
    );
  }, []);

  const setActivePanel = useCallback((panel: WorkspaceState["activePanel"]) => {
    setState((current) => touchWorkspaceState({ ...current, activePanel: panel }));
  }, []);

  const closeWorkspace = useCallback(() => {
    setState((current) =>
      touchWorkspaceState({ ...current, open: false, minimized: false, maximized: false })
    );
  }, []);

  const addWorkspaceEvent = useCallback(
    (title: string, detail: string, type: "system" | "user" = "system") => {
      setState((current) => {
        if (!current.session) return current;
        return touchWorkspaceState({
          ...current,
          session: appendWorkspaceEvent(current.session, createWorkspaceEvent(title, detail, type)),
        });
      });
    },
    []
  );

  const updateWorkspaceSession = useCallback((patch: Partial<WorkspaceSession>) => {
    setState((current) => {
      if (!current.session) return current;
      return touchWorkspaceState({
        ...current,
        session: {
          ...current.session,
          ...patch,
        },
      });
    });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      persistenceStatus,
      openWorkspace,
      minimizeWorkspace,
      expandWorkspace,
      maximizeWorkspace,
      restoreWorkspace,
      setActivePanel,
      closeWorkspace,
      addWorkspaceEvent,
      updateWorkspaceSession,
    }),
    [
      state,
      persistenceStatus,
      openWorkspace,
      minimizeWorkspace,
      expandWorkspace,
      maximizeWorkspace,
      restoreWorkspace,
      setActivePanel,
      closeWorkspace,
      addWorkspaceEvent,
      updateWorkspaceSession,
    ]
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
