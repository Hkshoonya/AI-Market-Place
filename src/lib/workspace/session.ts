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
  autoStartDeployment: boolean;
  nextUrl: string | null;
  conversationId: string | null;
  runtimeId: string | null;
  runtimeEndpointPath: string | null;
  deploymentId: string | null;
  deploymentEndpointPath: string | null;
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
  activePanel: "setup" | "assistant" | "usage";
  session: WorkspaceSession | null;
  updatedAt: string;
}

export const WORKSPACE_STORAGE_KEY = "aimc-deploy-workspace";
export const WORKSPACE_DEPLOYMENT_STARTED_EVENT = "aimc-workspace-deployment-started";
const MAX_WORKSPACE_EVENTS = 200;

function makeEventId() {
  return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

function makeTimestamp() {
  return new Date().toISOString();
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
  autoStartDeployment?: boolean | null;
  nextUrl?: string | null;
  conversationId?: string | null;
  runtimeId?: string | null;
  runtimeEndpointPath?: string | null;
  deploymentId?: string | null;
  deploymentEndpointPath?: string | null;
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
    autoStartDeployment: Boolean(input.autoStartDeployment),
    nextUrl: input.nextUrl ?? null,
    conversationId: input.conversationId ?? null,
    runtimeId: input.runtimeId ?? null,
    runtimeEndpointPath: input.runtimeEndpointPath ?? null,
    deploymentId: input.deploymentId ?? null,
    deploymentEndpointPath: input.deploymentEndpointPath ?? null,
    sponsored: Boolean(input.sponsored),
    suggestedPackSlug: input.suggestedPackSlug ?? null,
    suggestedPack: input.suggestedPack ?? null,
    suggestedAmount: input.suggestedAmount ?? null,
    startedAt: makeTimestamp(),
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
    events: [...session.events, event].slice(-MAX_WORKSPACE_EVENTS),
  };
}

export function createEmptyWorkspaceState(): WorkspaceState {
  return {
    open: false,
    minimized: false,
    maximized: false,
    activePanel: "setup",
    session: null,
    updatedAt: makeTimestamp(),
  };
}

export function touchWorkspaceState(
  state: Omit<WorkspaceState, "updatedAt"> & { updatedAt?: string }
): WorkspaceState {
  return {
    ...state,
    updatedAt: makeTimestamp(),
  };
}

function normalizeWorkspaceSession(
  value: unknown
): WorkspaceSession | null {
  if (!value || typeof value !== "object") return null;

  const session = value as Partial<WorkspaceSession>;
  const rawEvents = Array.isArray(session.events) ? session.events : [];

  return {
    model: typeof session.model === "string" ? session.model : null,
    modelSlug: typeof session.modelSlug === "string" ? session.modelSlug : null,
    provider: typeof session.provider === "string" ? session.provider : null,
    action: typeof session.action === "string" ? session.action : null,
    autoStartDeployment: Boolean(session.autoStartDeployment),
    nextUrl: typeof session.nextUrl === "string" ? session.nextUrl : null,
    conversationId:
      typeof session.conversationId === "string" ? session.conversationId : null,
    runtimeId: typeof session.runtimeId === "string" ? session.runtimeId : null,
    runtimeEndpointPath:
      typeof session.runtimeEndpointPath === "string" ? session.runtimeEndpointPath : null,
    deploymentId:
      typeof session.deploymentId === "string" ? session.deploymentId : null,
    deploymentEndpointPath:
      typeof session.deploymentEndpointPath === "string"
        ? session.deploymentEndpointPath
        : null,
    sponsored: Boolean(session.sponsored),
    suggestedPackSlug:
      typeof session.suggestedPackSlug === "string" ? session.suggestedPackSlug : null,
    suggestedPack: typeof session.suggestedPack === "string" ? session.suggestedPack : null,
    suggestedAmount:
      typeof session.suggestedAmount === "number" && Number.isFinite(session.suggestedAmount)
        ? session.suggestedAmount
        : null,
    startedAt:
      typeof session.startedAt === "string" && session.startedAt.length > 0
        ? session.startedAt
        : makeTimestamp(),
    events: rawEvents
      .map((event): WorkspaceEvent | null => {
        if (!event || typeof event !== "object") return null;
        const candidate = event as Partial<WorkspaceEvent>;
        return {
          id:
            typeof candidate.id === "string" && candidate.id.length > 0
              ? candidate.id
              : makeEventId(),
          type: candidate.type === "user" ? "user" : "system",
          title: typeof candidate.title === "string" ? candidate.title : "Workspace event",
          detail: typeof candidate.detail === "string" ? candidate.detail : "",
          createdAt:
            typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
              ? candidate.createdAt
              : makeTimestamp(),
        };
      })
      .filter((event): event is WorkspaceEvent => event !== null)
      .slice(-MAX_WORKSPACE_EVENTS),
  };
}

export function normalizeWorkspaceState(value: unknown): WorkspaceState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<WorkspaceState>;

  return {
    open: Boolean(parsed.open),
    minimized: Boolean(parsed.minimized),
    maximized: Boolean(parsed.maximized),
    activePanel:
      parsed.activePanel === "assistant" || parsed.activePanel === "usage"
        ? parsed.activePanel
        : "setup",
    session: normalizeWorkspaceSession(parsed.session),
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
        ? parsed.updatedAt
        : makeTimestamp(),
  };
}

export function parseWorkspaceState(raw: string | null | undefined): WorkspaceState | null {
  if (!raw) return null;
  try {
    return normalizeWorkspaceState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function pickNewerWorkspaceState(
  current: WorkspaceState | null,
  incoming: WorkspaceState | null
): WorkspaceState | null {
  if (!current) return incoming;
  if (!incoming) return current;

  const currentTime = Date.parse(current.updatedAt);
  const incomingTime = Date.parse(incoming.updatedAt);

  if (!Number.isFinite(currentTime)) return incoming;
  if (!Number.isFinite(incomingTime)) return current;
  return incomingTime > currentTime ? incoming : current;
}
