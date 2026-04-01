export interface WorkspaceEvent {
  id: string;
  type: "system" | "user";
  title: string;
  detail: string;
  createdAt: string;
}

export interface WorkspaceSession {
  model: string | null;
  modelSlug: string | null;
  provider: string | null;
  action: string | null;
  nextUrl: string | null;
  sponsored: boolean;
  suggestedPackSlug: string | null;
  suggestedPack: string | null;
  suggestedAmount: number | null;
  startedAt: string;
  events: WorkspaceEvent[];
}

export interface WorkspaceState {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  session: WorkspaceSession | null;
}

export const WORKSPACE_STORAGE_KEY = "aimc-deploy-workspace";

function makeEventId() {
  return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkspaceEvent(
  title: string,
  detail: string,
  type: WorkspaceEvent["type"] = "system"
): WorkspaceEvent {
  return {
    id: makeEventId(),
    type,
    title,
    detail,
    createdAt: new Date().toISOString(),
  };
}

export function createWorkspaceSession(input: {
  model?: string | null;
  modelSlug?: string | null;
  provider?: string | null;
  action?: string | null;
  nextUrl?: string | null;
  sponsored?: boolean | null;
  suggestedPackSlug?: string | null;
  suggestedPack?: string | null;
  suggestedAmount?: number | null;
}): WorkspaceSession {
  return {
    model: input.model ?? null,
    modelSlug: input.modelSlug ?? null,
    provider: input.provider ?? null,
    action: input.action ?? null,
    nextUrl: input.nextUrl ?? null,
    sponsored: Boolean(input.sponsored),
    suggestedPackSlug: input.suggestedPackSlug ?? null,
    suggestedPack: input.suggestedPack ?? null,
    suggestedAmount: input.suggestedAmount ?? null,
    startedAt: new Date().toISOString(),
    events: [
      createWorkspaceEvent(
        "Workspace started",
        input.model
          ? `Prepared an in-site start flow for ${input.model}.`
          : "Prepared an in-site start flow."
      ),
    ],
  };
}

export function appendWorkspaceEvent(
  session: WorkspaceSession,
  event: WorkspaceEvent
): WorkspaceSession {
  return {
    ...session,
    events: [...session.events, event],
  };
}

export function parseWorkspaceState(raw: string | null | undefined): WorkspaceState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      open: Boolean(parsed.open),
      minimized: Boolean(parsed.minimized),
      maximized: Boolean(parsed.maximized),
      session: parsed.session
        ? {
            ...parsed.session,
            sponsored: Boolean(parsed.session.sponsored),
            suggestedPackSlug:
              typeof parsed.session.suggestedPackSlug === "string"
                ? parsed.session.suggestedPackSlug
                : null,
          }
        : null,
    };
  } catch {
    return null;
  }
}
