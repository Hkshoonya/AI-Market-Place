import type { User as SupabaseUser } from "@supabase/supabase-js";
import { authenticateApiKey } from "@/lib/agents/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAgentActorFromApiKeyRecord,
  resolveOrCreateHumanActor,
} from "./actors";

export interface ResolvedSocialActor {
  actor: {
    id: string;
    actor_type: "human" | "agent" | "organization_agent" | "hybrid";
    display_name: string;
    handle?: string;
  };
  authMethod: "session" | "api_key";
  keyRecord?: Record<string, unknown>;
}

export async function resolveSocialActorFromRequest(
  request: Request
): Promise<ResolvedSocialActor | null> {
  const admin = createAdminClient();

  let sessionUser: SupabaseUser | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    sessionUser = user ?? null;
  } catch {
    // Session missing or supabase unreachable — fall through to API key auth.
  }

  if (sessionUser) {
    const actor = await resolveOrCreateHumanActor(admin, sessionUser.id, {
      email: sessionUser.email ?? null,
      username:
        typeof sessionUser.user_metadata?.preferred_username === "string"
          ? sessionUser.user_metadata.preferred_username
          : typeof sessionUser.user_metadata?.username === "string"
            ? sessionUser.user_metadata.username
            : null,
      displayName:
        typeof sessionUser.user_metadata?.full_name === "string"
          ? sessionUser.user_metadata.full_name
          : typeof sessionUser.user_metadata?.name === "string"
            ? sessionUser.user_metadata.name
            : null,
      avatarUrl:
        typeof sessionUser.user_metadata?.avatar_url === "string"
          ? sessionUser.user_metadata.avatar_url
          : typeof sessionUser.user_metadata?.picture === "string"
            ? sessionUser.user_metadata.picture
            : null,
    });
    return {
      actor: {
        id: actor.id,
        actor_type: actor.actor_type,
        display_name: actor.display_name,
        handle: actor.handle,
      },
      authMethod: "session",
    };
  }

  const auth = await authenticateApiKey(admin, request);
  if (!auth.authenticated) return null;

  const scopes = Array.isArray(auth.keyRecord.scopes)
    ? (auth.keyRecord.scopes as string[])
    : [];
  const hasSocialScope =
    scopes.includes("agent") || scopes.includes("write") || scopes.includes("marketplace");

  if (!hasSocialScope) return null;

  const actor = await resolveAgentActorFromApiKeyRecord(admin, auth.keyRecord);
  if (!actor) return null;

  return {
    actor: {
      id: actor.id,
      actor_type: actor.actor_type,
      display_name: actor.display_name,
      handle: actor.handle,
    },
    authMethod: "api_key",
    keyRecord: auth.keyRecord,
  };
}
