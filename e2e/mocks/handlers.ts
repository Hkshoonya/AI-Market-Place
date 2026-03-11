import { http, HttpResponse } from "msw";
import modelDetailFixture from "../fixtures/model-detail.json";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";

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

  // Auth endpoint — return 401 (unauthenticated)
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json({ id: null }, { status: 401 });
  }),
];
