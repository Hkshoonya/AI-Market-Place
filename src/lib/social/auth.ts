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

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const actor = await resolveOrCreateHumanActor(admin, user.id);
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
  } catch {
    // Session missing, continue to API key auth.
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
