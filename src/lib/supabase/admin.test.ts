import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminClient, createOptionalAdminClient, hasAdminClientConfig } from "./admin";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stateless service-role clients", () => {
  it("retains missing-configuration behavior without initializing auth", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(hasAdminClientConfig()).toBe(false);
    expect(createOptionalAdminClient()).toBeNull();
    expect(() => createAdminClient()).toThrow("Missing Supabase admin configuration");
  });

  it("does not create authentication intervals across repeated server requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-not-a-real-credential");
    const network = vi.fn(() => Promise.reject(new Error("No network in this regression")));
    vi.stubGlobal("fetch", network);
    const interval = vi.spyOn(globalThis, "setInterval");
    const clients = Array.from({ length: 250 }, (_, index) =>
      index % 2 ? createAdminClient() : createOptionalAdminClient()!
    );
    try {
      await Promise.all(clients.map((client) => client.auth.initialize()));
      expect(interval).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
      for (const client of clients) {
        expect(Reflect.get(client.auth, "autoRefreshToken")).toBe(false);
        expect(Reflect.get(client.auth, "persistSession")).toBe(false);
        expect(Reflect.get(client.auth, "detectSessionInUrl")).toBe(false);
      }
      expect(clients[0]).not.toBe(clients[1]);
    } finally {
      await Promise.all(clients.map((client) => client.auth.stopAutoRefresh()));
    }
  });
});
