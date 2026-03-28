import { http, HttpResponse } from "msw";
import modelDetailFixture from "../fixtures/model-detail.json";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";

const socialCommunity = {
  id: "community-global",
  slug: "global",
  name: "Global",
  description: "Global commons feed",
  is_global: true,
};

const networkActor = {
  id: "actor-human-1",
  actor_type: "human",
  owner_user_id: "user-1",
  profile_id: "profile-1",
  agent_id: null,
  display_name: "Harshit",
  handle: "harshit",
  avatar_url: null,
  bio: "Open builder",
  is_public: true,
  trust_tier: "verified",
  reputation_score: 88,
  autonomy_enabled: false,
  metadata: null,
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};

const socialThread = {
  id: "thread-1",
  created_by_actor_id: networkActor.id,
  community_id: socialCommunity.id,
  root_post_id: "post-1",
  title: "Benchmark discussion",
  visibility: "public",
  language_code: "en",
  reply_count: 0,
  last_posted_at: "2026-03-01T00:00:00.000Z",
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};

const socialPost = {
  id: "post-1",
  thread_id: socialThread.id,
  parent_post_id: null,
  author_actor_id: networkActor.id,
  community_id: socialCommunity.id,
  content: "Commons test post",
  language_code: "en",
  status: "published",
  reply_count: 0,
  metadata: null,
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};

function countHeaders(total: number) {
  return {
    "content-range": `0-0/${total}`,
    "content-type": "application/json",
  };
}

export const handlers = [
  // Main model query (with joins) and generateMetadata query.
  // Distinguishes single-model queries (.single()) from list queries by checking
  // for a slug param — PostgREST sends ?slug=eq.{value} for .eq("slug", ...) calls.
  http.get(`${SUPABASE_URL}/rest/v1/models`, ({ request }) => {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get("slug");
    if (slugParam?.startsWith("eq.")) {
      // Single model query (.single()) — return object, not array
      return HttpResponse.json(modelDetailFixture.primary_model);
    }
    // Similar models query or list query — return array
    return HttpResponse.json(modelDetailFixture.similar_models);
  }),

  // model_snapshots table
  http.get(`${SUPABASE_URL}/rest/v1/model_snapshots`, () => {
    return HttpResponse.json(modelDetailFixture.snapshots);
  }),

  // model_news table
  http.get(`${SUPABASE_URL}/rest/v1/model_news`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_communities`, ({ request }) => {
    const prefer = request.headers.get("prefer") ?? "";
    if (prefer.includes("count=exact") && request.headers.get("x-head") === "true") {
      return new HttpResponse(null, {
        status: 200,
        headers: countHeaders(1),
      });
    }

    return HttpResponse.json([socialCommunity], {
      headers: countHeaders(1),
    });
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_communities`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: countHeaders(1),
    });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/network_actors`, ({ request }) => {
    const prefer = request.headers.get("prefer") ?? "";
    if (prefer.includes("count=exact") && request.headers.get("x-head") === "true") {
      return new HttpResponse(null, {
        status: 200,
        headers: countHeaders(1),
      });
    }

    return HttpResponse.json([networkActor], {
      headers: countHeaders(1),
    });
  }),
  http.head(`${SUPABASE_URL}/rest/v1/network_actors`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: countHeaders(1),
    });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_threads`, ({ request }) => {
    const prefer = request.headers.get("prefer") ?? "";
    if (prefer.includes("count=exact") && request.headers.get("x-head") === "true") {
      return new HttpResponse(null, {
        status: 200,
        headers: countHeaders(1),
      });
    }

    return HttpResponse.json([socialThread], {
      headers: countHeaders(1),
    });
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_threads`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: countHeaders(1),
    });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_posts`, ({ request }) => {
    const prefer = request.headers.get("prefer") ?? "";
    if (prefer.includes("count=exact") && request.headers.get("x-head") === "true") {
      return new HttpResponse(null, {
        status: 200,
        headers: countHeaders(1),
      });
    }

    return HttpResponse.json([socialPost], {
      headers: countHeaders(1),
    });
  }),
  http.head(`${SUPABASE_URL}/rest/v1/social_posts`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: countHeaders(1),
    });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/social_post_media`, () => {
    return HttpResponse.json([], {
      headers: countHeaders(0),
    });
  }),

  // Auth endpoint — return 401 (unauthenticated)
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json({ id: null }, { status: 401 });
  }),
];
