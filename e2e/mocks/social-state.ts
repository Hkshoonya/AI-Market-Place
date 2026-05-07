import { mockProfile, mockUser } from "./auth-fixtures";

export interface MockSocialCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  created_by_actor_id: string | null;
}

export interface MockNetworkActor {
  id: string;
  actor_type: "human" | "agent" | "organization_agent" | "hybrid";
  owner_user_id: string;
  profile_id: string | null;
  agent_id: string | null;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  trust_tier: "basic" | "trusted" | "verified";
  reputation_score: number;
  autonomy_enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MockSocialThread {
  id: string;
  created_by_actor_id: string;
  community_id: string | null;
  root_post_id: string | null;
  title: string | null;
  visibility: "public" | "community";
  language_code: string | null;
  reply_count: number;
  last_posted_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MockSocialPost {
  id: string;
  thread_id: string;
  parent_post_id: string | null;
  author_actor_id: string;
  community_id: string | null;
  content: string;
  language_code: string | null;
  status: "draft" | "published" | "removed";
  reply_count: number;
  metadata: Record<string, unknown> | null;
  moderation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockSocialPostMedia {
  id: string;
  post_id: string;
  media_type: "image" | "link_preview";
  url: string;
  alt_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface MockSocialState {
  communities: MockSocialCommunity[];
  profiles: Array<Record<string, unknown>>;
  actors: MockNetworkActor[];
  threads: MockSocialThread[];
  posts: MockSocialPost[];
  media: MockSocialPostMedia[];
  threadBlocks: Array<{ id: string; thread_id: string; blocked_actor_id: string }>;
  workspaceSessions: Array<{
    user_id: string;
    workspace_state: Record<string, unknown>;
  }>;
}

const ISO_TIME = "2026-03-01T00:00:00.000Z";

export const socialCommunity: MockSocialCommunity = {
  id: "community-global",
  slug: "global",
  name: "Global",
  description: "Global commons feed",
  is_global: true,
  created_at: ISO_TIME,
  updated_at: ISO_TIME,
  created_by_actor_id: null,
};

const initialActor: MockNetworkActor = {
  id: "actor-human-1",
  actor_type: "human",
  owner_user_id: mockUser.id,
  profile_id: mockUser.id,
  agent_id: null,
  display_name: "E2E Tester",
  handle: "e2e-tester",
  avatar_url: null,
  bio: "Open builder",
  is_public: true,
  trust_tier: "verified",
  reputation_score: 88,
  autonomy_enabled: false,
  metadata: {},
  created_at: ISO_TIME,
  updated_at: ISO_TIME,
};

const initialThread: MockSocialThread = {
  id: "thread-1",
  created_by_actor_id: initialActor.id,
  community_id: socialCommunity.id,
  root_post_id: "post-1",
  title: "Benchmark discussion",
  visibility: "public",
  language_code: "en",
  reply_count: 0,
  last_posted_at: ISO_TIME,
  metadata: {},
  created_at: ISO_TIME,
  updated_at: ISO_TIME,
};

const initialPost: MockSocialPost = {
  id: "post-1",
  thread_id: initialThread.id,
  parent_post_id: null,
  author_actor_id: initialActor.id,
  community_id: socialCommunity.id,
  content: "Commons test post",
  language_code: "en",
  status: "published",
  reply_count: 0,
  metadata: {},
  created_at: ISO_TIME,
  updated_at: ISO_TIME,
};

function createInitialState(): MockSocialState {
  return {
    communities: [{ ...socialCommunity }],
    profiles: [{ ...mockProfile }],
    actors: [{ ...initialActor }],
    threads: [{ ...initialThread }],
    posts: [{ ...initialPost }],
    media: [],
    threadBlocks: [],
    workspaceSessions: [],
  };
}

let state = createInitialState();
let nextSequence = 2;

function nextId(prefix: string) {
  const id = `${prefix}-${nextSequence}`;
  nextSequence += 1;
  return id;
}

export function listCommunities() {
  return state.communities.map((item) => ({ ...item }));
}

export function listProfiles() {
  return state.profiles.map((item) => ({ ...item }));
}

export function listActors() {
  return state.actors.map((item) => ({ ...item }));
}

export function listThreads() {
  return state.threads.map((item) => ({ ...item }));
}

export function listPosts() {
  return state.posts.map((item) => ({ ...item }));
}

export function listMedia() {
  return state.media.map((item) => ({ ...item }));
}

export function listThreadBlocks() {
  return state.threadBlocks.map((item) => ({ ...item }));
}

export function listWorkspaceSessions() {
  return state.workspaceSessions.map((item) => ({
    user_id: item.user_id,
    workspace_state: structuredClone(item.workspace_state),
  }));
}

export function insertActor(
  actor: Omit<MockNetworkActor, "id" | "created_at" | "updated_at"> &
    Partial<Pick<MockNetworkActor, "id" | "created_at" | "updated_at">>
) {
  const now = new Date().toISOString();
  const nextActor: MockNetworkActor = {
    id: actor.id ?? nextId("actor"),
    actor_type: actor.actor_type,
    owner_user_id: actor.owner_user_id,
    profile_id: actor.profile_id ?? null,
    agent_id: actor.agent_id ?? null,
    display_name: actor.display_name,
    handle: actor.handle,
    avatar_url: actor.avatar_url ?? null,
    bio: actor.bio ?? null,
    is_public: actor.is_public,
    trust_tier: actor.trust_tier,
    reputation_score: actor.reputation_score,
    autonomy_enabled: actor.autonomy_enabled,
    metadata: actor.metadata ?? {},
    created_at: actor.created_at ?? now,
    updated_at: actor.updated_at ?? now,
  };

  state.actors.unshift(nextActor);
  return { ...nextActor };
}

export function createThread(input: {
  actorId: string;
  title?: string | null;
  communityId?: string | null;
  visibility: "public" | "community";
  languageCode?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const now = new Date().toISOString();
  const threadId = nextId("thread");

  const thread: MockSocialThread = {
    id: threadId,
    created_by_actor_id: input.actorId,
    community_id: input.communityId ?? null,
    root_post_id: null,
    title: input.title ?? null,
    visibility: input.visibility,
    language_code: input.languageCode ?? null,
    reply_count: 0,
    last_posted_at: now,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  state.threads.unshift(thread);

  return { ...thread };
}

export function createRootPost(input: {
  threadId: string;
  actorId: string;
  content: string;
  communityId?: string | null;
  languageCode?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const now = new Date().toISOString();
  const postId = nextId("post");
  const post: MockSocialPost = {
    id: postId,
    thread_id: input.threadId,
    parent_post_id: null,
    author_actor_id: input.actorId,
    community_id: input.communityId ?? null,
    content: input.content,
    language_code: input.languageCode ?? null,
    status: "published",
    reply_count: 0,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  state.posts.unshift(post);
  updateThread(input.threadId, {
    root_post_id: post.id,
    last_posted_at: now,
    updated_at: now,
  });

  return { ...post };
}

export function createReply(input: {
  threadId: string;
  parentPostId: string;
  actorId: string;
  communityId?: string | null;
  content: string;
  languageCode?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const now = new Date().toISOString();
  const replyId = nextId("post");

  const reply: MockSocialPost = {
    id: replyId,
    thread_id: input.threadId,
    parent_post_id: input.parentPostId,
    author_actor_id: input.actorId,
    community_id: input.communityId ?? null,
    content: input.content,
    language_code: input.languageCode ?? null,
    status: "published",
    reply_count: 0,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  state.posts.push(reply);
  updatePost(input.parentPostId, {
    reply_count: (findPost(input.parentPostId)?.reply_count ?? 0) + 1,
    updated_at: now,
  });
  updateThread(input.threadId, {
    reply_count: (findThread(input.threadId)?.reply_count ?? 0) + 1,
    last_posted_at: now,
    updated_at: now,
  });

  return { ...reply };
}

export function createMediaRecords(
  records: Array<{
    post_id: string;
    media_type: "image" | "link_preview";
    url: string;
    alt_text?: string | null;
    metadata?: Record<string, unknown> | null;
  }>
) {
  const now = new Date().toISOString();
  const created = records.map((record) => ({
    id: nextId("media"),
    post_id: record.post_id,
    media_type: record.media_type,
    url: record.url,
    alt_text: record.alt_text ?? null,
    metadata: record.metadata ?? {},
    created_at: now,
  }));

  state.media.push(...created);
  return created.map((item) => ({ ...item }));
}

export function updateThread(id: string, patch: Partial<MockSocialThread>) {
  const thread = state.threads.find((item) => item.id === id);
  if (!thread) return null;
  Object.assign(thread, patch);
  return { ...thread };
}

export function updatePost(id: string, patch: Partial<MockSocialPost>) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return null;
  Object.assign(post, patch);
  return { ...post };
}

export function findPost(id: string) {
  const post = state.posts.find((item) => item.id === id);
  return post ? { ...post } : null;
}

export function findThread(id: string) {
  const thread = state.threads.find((item) => item.id === id);
  return thread ? { ...thread } : null;
}

export function upsertProfile(profile: Record<string, unknown>) {
  const id = typeof profile.id === "string" ? profile.id : null;
  if (!id) return null;

  const existingIndex = state.profiles.findIndex((item) => item.id === id);
  if (existingIndex === -1) {
    state.profiles.push({ ...profile });
    return { ...profile };
  }

  state.profiles[existingIndex] = {
    ...state.profiles[existingIndex],
    ...profile,
  };
  return { ...state.profiles[existingIndex] };
}

export function upsertWorkspaceSession(record: Record<string, unknown>) {
  const userId = typeof record.user_id === "string" ? record.user_id : null;
  const workspaceState =
    record.workspace_state &&
    typeof record.workspace_state === "object" &&
    !Array.isArray(record.workspace_state)
      ? structuredClone(record.workspace_state as Record<string, unknown>)
      : null;

  if (!userId || !workspaceState) return null;

  const existingIndex = state.workspaceSessions.findIndex(
    (item) => item.user_id === userId
  );

  const nextRecord = {
    user_id: userId,
    workspace_state: workspaceState,
  };

  if (existingIndex === -1) {
    state.workspaceSessions.push(nextRecord);
    return {
      user_id: nextRecord.user_id,
      workspace_state: structuredClone(nextRecord.workspace_state),
    };
  }

  state.workspaceSessions[existingIndex] = nextRecord;
  return {
    user_id: nextRecord.user_id,
    workspace_state: structuredClone(nextRecord.workspace_state),
  };
}

export function deleteWorkspaceSessionsByUserId(userId: string) {
  const before = state.workspaceSessions.length;
  state.workspaceSessions = state.workspaceSessions.filter(
    (item) => item.user_id !== userId
  );
  return before - state.workspaceSessions.length;
}

export function resetSocialState() {
  state = createInitialState();
  nextSequence = 2;
}
