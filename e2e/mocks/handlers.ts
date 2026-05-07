import { http, HttpResponse } from "msw";
import modelDetailFixture from "../fixtures/model-detail.json";
import { buildMockSession, mockUser } from "./auth-fixtures";
import {
  createMediaRecords,
  createReply,
  createRootPost,
  createThread,
  deleteWorkspaceSessionsByUserId,
  insertActor,
  listActors,
  listCommunities,
  listMedia,
  listPosts,
  listProfiles,
  listThreadBlocks,
  listThreads,
  listWorkspaceSessions,
  updatePost,
  updateThread,
  upsertProfile,
  upsertWorkspaceSession,
} from "./social-state";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";

function countHeaders(total: number) {
  return {
    "content-range": `0-0/${total}`,
    "content-type": "application/json",
  };
}

function requestsCountOnly(request: Request) {
  return request.headers.get("x-head") === "true";
}

function cloneRows<T>(rows: T[]) {
  return rows.map((row) => ({ ...row }));
}

function parseInValues(raw: string) {
  if (!raw.startsWith("in.(") || !raw.endsWith(")")) {
    return null;
  }

  return raw
    .slice(4, -1)
    .split(",")
    .map((item) => decodeURIComponent(item.replace(/^"|"$/g, "")));
}

function applyQueryFilters<T extends Record<string, unknown>>(
  rows: T[],
  request: Request
) {
  const url = new URL(request.url);
  let filtered = [...rows];

  for (const [key, rawValue] of url.searchParams.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "offset") {
      continue;
    }

    if (rawValue.startsWith("eq.")) {
      const expected = decodeURIComponent(rawValue.slice(3));
      filtered = filtered.filter((row) => String(row[key] ?? "") === expected);
      continue;
    }

    const inValues = parseInValues(rawValue);
    if (inValues) {
      filtered = filtered.filter((row) =>
        inValues.includes(String(row[key] ?? ""))
      );
    }
  }

  for (const clause of url.searchParams.getAll("order")) {
    const sortSpecs = clause.split(",").map((entry) => {
      const [column, direction = "asc"] = entry.split(".");
      return { column, direction };
    });

    filtered.sort((left, right) => {
      for (const { column, direction } of sortSpecs) {
        const leftValue = left[column];
        const rightValue = right[column];

        if (leftValue === rightValue) continue;
        if (leftValue === null || leftValue === undefined) return 1;
        if (rightValue === null || rightValue === undefined) return -1;

        if (
          typeof leftValue === "string" &&
          typeof rightValue === "string" &&
          leftValue.includes("T") &&
          rightValue.includes("T")
        ) {
          const leftTime = new Date(leftValue).getTime();
          const rightTime = new Date(rightValue).getTime();
          if (leftTime !== rightTime) {
            return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
          }
          continue;
        }

        if (leftValue > rightValue) {
          return direction === "desc" ? -1 : 1;
        }

        return direction === "desc" ? 1 : -1;
      }

      return 0;
    });
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? null : Number(rawLimit);
  if (limit !== null && Number.isFinite(limit) && limit >= 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function shouldReturnObject(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function jsonResult<T extends Record<string, unknown>>(
  request: Request,
  rows: T[]
) {
  if (shouldReturnObject(request)) {
    return HttpResponse.json(rows[0] ?? null);
  }

  return HttpResponse.json(rows, {
    headers: countHeaders(rows.length),
  });
}

function countResult<T extends Record<string, unknown>>(rows: T[]) {
  return new HttpResponse(null, {
    status: 200,
    headers: countHeaders(rows.length),
  });
}

function isAuthenticatedRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.includes("mock-access-token-for-e2e-testing")) {
    return true;
  }

  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("sb-localhost-auth-token");
}

async function readBody(request: Request) {
  const body = await request.json().catch(() => null);
  if (Array.isArray(body)) {
    return body;
  }

  return body ? [body] : [];
}

export const handlers = [
  http.get(`${SUPABASE_URL}/rest/v1/models`, ({ request }) => {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get("slug");

    if (slugParam?.startsWith("eq.")) {
      return HttpResponse.json(modelDetailFixture.primary_model);
    }

    return HttpResponse.json(modelDetailFixture.similar_models);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/model_snapshots`, () => {
    return HttpResponse.json(modelDetailFixture.snapshots);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/model_news`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_communities`, ({ request }) => {
    const rows = applyQueryFilters(cloneRows(listCommunities()), request);
    if (requestsCountOnly(request)) {
      return countResult(rows);
    }
    return jsonResult(request, rows);
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_communities`, ({ request }) => {
    const rows = applyQueryFilters(cloneRows(listCommunities()), request);
    return countResult(rows);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/profiles`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listProfiles()) as Array<Record<string, unknown>>,
      request
    );
    return jsonResult(request, rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/profiles`, async ({ request }) => {
    const records = await readBody(request);
    const saved = records
      .map((record) => upsertProfile(record as Record<string, unknown>))
      .filter((record): record is Record<string, unknown> => record !== null);
    return jsonResult(request, saved);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/workspace_sessions`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listWorkspaceSessions()) as Array<Record<string, unknown>>,
      request
    );
    if (requestsCountOnly(request)) {
      return countResult(rows);
    }
    return jsonResult(request, rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/workspace_sessions`, async ({ request }) => {
    const records = await readBody(request);
    const saved: Array<Record<string, unknown>> = [];

    for (const record of records) {
      const nextRecord = upsertWorkspaceSession(record as Record<string, unknown>);
      if (nextRecord) {
        saved.push(nextRecord);
      }
    }

    const prefer = request.headers.get("prefer") ?? "";
    if (prefer.includes("return=minimal")) {
      return new HttpResponse(null, { status: 201 });
    }

    return jsonResult(request, saved);
  }),
  http.delete(`${SUPABASE_URL}/rest/v1/workspace_sessions`, ({ request }) => {
    const userIdFilter = new URL(request.url).searchParams.get("user_id");
    const userId =
      userIdFilter?.startsWith("eq.")
        ? decodeURIComponent(userIdFilter.slice(3))
        : null;

    if (userId) {
      deleteWorkspaceSessionsByUserId(userId);
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/network_actors`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listActors()) as Array<Record<string, unknown>>,
      request
    );
    if (requestsCountOnly(request)) {
      return countResult(rows);
    }
    return jsonResult(request, rows);
  }),
  http.head(`${SUPABASE_URL}/rest/v1/network_actors`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listActors()) as Array<Record<string, unknown>>,
      request
    );
    return countResult(rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/network_actors`, async ({ request }) => {
    const [record] = await readBody(request);
    const created = insertActor({
      actor_type:
        record.actor_type === "agent" ||
        record.actor_type === "organization_agent" ||
        record.actor_type === "hybrid"
          ? record.actor_type
          : "human",
      owner_user_id: String(record.owner_user_id),
      profile_id:
        typeof record.profile_id === "string" ? record.profile_id : null,
      agent_id: typeof record.agent_id === "string" ? record.agent_id : null,
      display_name: String(record.display_name),
      handle: String(record.handle),
      avatar_url:
        typeof record.avatar_url === "string" ? record.avatar_url : null,
      bio: typeof record.bio === "string" ? record.bio : null,
      is_public: record.is_public !== false,
      trust_tier:
        record.trust_tier === "verified" || record.trust_tier === "trusted"
          ? record.trust_tier
          : "basic",
      reputation_score:
        typeof record.reputation_score === "number" ? record.reputation_score : 0,
      autonomy_enabled: record.autonomy_enabled !== false,
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
    });
    return jsonResult(request, [created]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_threads`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listThreads()) as Array<Record<string, unknown>>,
      request
    );
    if (requestsCountOnly(request)) {
      return countResult(rows);
    }
    return jsonResult(request, rows);
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_threads`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listThreads()) as Array<Record<string, unknown>>,
      request
    );
    return countResult(rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/social_threads`, async ({ request }) => {
    const [record] = await readBody(request);
    const created = createThread({
      actorId: String(record.created_by_actor_id),
      title: typeof record.title === "string" ? record.title : null,
      communityId:
        typeof record.community_id === "string" ? record.community_id : null,
      visibility:
        record.visibility === "community" ? "community" : "public",
      languageCode:
        typeof record.language_code === "string" ? record.language_code : null,
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
    });

    return jsonResult(request, [created]);
  }),
  http.patch(`${SUPABASE_URL}/rest/v1/social_threads`, async ({ request }) => {
    const url = new URL(request.url);
    const [patch] = await readBody(request);
    const idFilter = url.searchParams.get("id");
    const threadId =
      idFilter?.startsWith("eq.") ? decodeURIComponent(idFilter.slice(3)) : null;

    if (threadId) {
      updateThread(threadId, patch as Record<string, unknown>);
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_posts`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listPosts()) as Array<Record<string, unknown>>,
      request
    );
    if (requestsCountOnly(request)) {
      return countResult(rows);
    }
    return jsonResult(request, rows);
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_posts`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listPosts()) as Array<Record<string, unknown>>,
      request
    );
    return countResult(rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/social_posts`, async ({ request }) => {
    const [record] = await readBody(request);

    if (record.parent_post_id) {
      const reply = createReply({
        threadId: String(record.thread_id),
        parentPostId: String(record.parent_post_id),
        actorId: String(record.author_actor_id),
        communityId:
          typeof record.community_id === "string" ? record.community_id : null,
        content: String(record.content ?? ""),
        languageCode:
          typeof record.language_code === "string" ? record.language_code : null,
        metadata:
          record.metadata && typeof record.metadata === "object"
            ? (record.metadata as Record<string, unknown>)
            : {},
      });
      return jsonResult(request, [reply]);
    }

    const threadId = String(record.thread_id);
    const post = createRootPost({
      threadId,
      actorId: String(record.author_actor_id),
      content: String(record.content ?? ""),
      communityId:
        typeof record.community_id === "string" ? record.community_id : null,
      languageCode:
        typeof record.language_code === "string" ? record.language_code : null,
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
    });

    return jsonResult(request, [post]);
  }),
  http.patch(`${SUPABASE_URL}/rest/v1/social_posts`, async ({ request }) => {
    const url = new URL(request.url);
    const [patch] = await readBody(request);
    const idFilter = url.searchParams.get("id");
    const postId =
      idFilter?.startsWith("eq.") ? decodeURIComponent(idFilter.slice(3)) : null;

    if (postId) {
      updatePost(postId, patch as Record<string, unknown>);
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_post_media`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listMedia()) as Array<Record<string, unknown>>,
      request
    );
    return jsonResult(request, rows);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/social_post_media`, async ({ request }) => {
    const records = await readBody(request);
    const created = createMediaRecords(
      records.map((record) => ({
        post_id: String(record.post_id),
        media_type:
          record.media_type === "link_preview" ? "link_preview" : "image",
        url: String(record.url),
        alt_text:
          typeof record.alt_text === "string" ? record.alt_text : null,
        metadata:
          record.metadata && typeof record.metadata === "object"
            ? (record.metadata as Record<string, unknown>)
            : {},
      }))
    );
    return jsonResult(request, created);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_thread_blocks`, ({ request }) => {
    const rows = applyQueryFilters(
      cloneRows(listThreadBlocks()) as Array<Record<string, unknown>>,
      request
    );
    return jsonResult(request, rows);
  }),

  http.get(`${SUPABASE_URL}/auth/v1/user`, ({ request }) => {
    if (!isAuthenticatedRequest(request)) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return HttpResponse.json(mockUser);
  }),
  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json(buildMockSession());
  }),
];
