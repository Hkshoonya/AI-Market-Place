import { describe, expect, it, vi } from "vitest";
import { loadActiveApiKeyOwner, validateApiKey } from "./auth";
import type { TypedSupabaseClient } from "@/types/database";

function client(profile: unknown, error: unknown = null) {
  const query = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq", "update"]) chain[name] = () => chain;
    chain.single = async () => result;
    chain.then = (resolve: (value: unknown) => void) => resolve(result);
    return chain;
  };
  return { from: vi.fn((table: string) => query(table === "profiles" ? { data: profile, error } : {
    data: { id: "key-1", owner_id: "user-1", scopes: ["read"], is_active: true, expires_at: null }, error: null,
  })) } as unknown as TypedSupabaseClient;
}

describe("API key owner enforcement", () => {
  it("fails closed for banned, removed, or unavailable owners", async () => {
    for (const supabase of [client({ is_banned: true }), client(null), client({ is_banned: false }, { message: "offline" })]) {
      expect(await loadActiveApiKeyOwner(supabase, "user-1")).toBeNull();
      expect(await validateApiKey(supabase, "aimk_test")).toMatchObject({ valid: false, keyRecord: null });
    }
  });
  it("allows an active owner and preserves profile enrichment", async () => {
    const profile = { id: "user-1", is_banned: false, is_admin: false };
    expect(await validateApiKey(client(profile), "aimk_test")).toMatchObject({ valid: true, keyRecord: { profiles: profile } });
  });
  it("does not query the database for an ownerless key", async () => {
    const supabase = client({ is_banned: false });
    expect(await loadActiveApiKeyOwner(supabase, null)).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
