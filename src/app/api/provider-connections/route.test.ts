import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockValidateProviderCredential = vi.fn();
const mockEncryptProviderSecret = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/provider-connections/providers", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/provider-connections/providers")
  >("@/lib/provider-connections/providers");
  return {
    ...actual,
    validateProviderCredential: (...args: unknown[]) =>
      mockValidateProviderCredential(...args),
  };
});

vi.mock("@/lib/provider-connections/crypto", () => ({
  decryptProviderSecret: vi.fn(),
  encryptProviderSecret: (...args: unknown[]) => mockEncryptProviderSecret(...args),
  getProviderSecretHint: vi.fn(() => "...1234"),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 10, remaining: 9, reset: 60 })),
  RATE_LIMITS: { auth: { limit: 10, windowMs: 60_000 } },
  rateLimitHeaders: vi.fn(() => ({})),
}));

import { GET, POST } from "./route";

function session(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

function adminForConnection(options?: {
  existing?: { id: string; external_account_id: string | null } | null;
  deploymentCount?: number;
}) {
  const inserted: Record<string, unknown>[] = [];
  const existing = options?.existing ?? null;
  const connectionRow = {
    id: existing?.id ?? "11111111-1111-4111-8111-111111111111",
    provider: "openrouter",
    display_name: "OpenRouter",
    secret_hint: "...1234",
    external_account_id: "account-new",
    external_account_name: "Production key",
    capabilities: ["routed_inference"],
    status: "active",
    last_validated_at: "2026-07-19T12:00:00.000Z",
    last_used_at: null,
    last_error: null,
    created_at: "2026-07-19T12:00:00.000Z",
    updated_at: "2026-07-19T12:00:00.000Z",
  };

  return {
    inserted,
    client: {
      from: (table: string) => {
        if (table === "provider_connections") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: existing, error: null }),
                }),
              }),
            }),
            upsert: (payload: Record<string, unknown>) => {
              inserted.push(payload);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: connectionRow, error: null }),
                }),
              };
            },
          };
        }
        if (table === "workspace_deployments") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({ count: options?.deploymentCount ?? 0, error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

describe("provider connection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEncryptProviderSecret.mockReturnValue("v1.encrypted.envelope.value");
    mockValidateProviderCredential.mockResolvedValue({
      externalAccountId: "account-new",
      externalAccountName: "Production key",
      capabilities: ["routed_inference"],
    });
  });

  it("requires authentication before listing credentials", async () => {
    mockCreateClient.mockResolvedValue(session(null));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin connection mutations before validating a token", async () => {
    mockCreateClient.mockResolvedValue(session({ id: "user-1" }));

    const response = await POST(
      new Request("https://aimarketcap.tech/api/provider-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ provider: "openrouter", token: "sk-or-v1-test1234" }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockValidateProviderCredential).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("blocks replacing a live connection with a different provider account", async () => {
    mockCreateClient.mockResolvedValue(session({ id: "user-1" }));
    const admin = adminForConnection({
      existing: {
        id: "11111111-1111-4111-8111-111111111111",
        external_account_id: "account-old",
      },
      deploymentCount: 1,
    });
    mockCreateAdminClient.mockReturnValue(admin.client);

    const response = await POST(
      new Request("https://aimarketcap.tech/api/provider-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ provider: "openrouter", token: "sk-or-v1-test1234" }),
      })
    );

    expect(response.status).toBe(409);
    expect(admin.inserted).toEqual([]);
    expect(mockEncryptProviderSecret).not.toHaveBeenCalled();
  });

  it("stores only the encrypted credential and returns public metadata", async () => {
    mockCreateClient.mockResolvedValue(session({ id: "user-1" }));
    const admin = adminForConnection();
    mockCreateAdminClient.mockReturnValue(admin.client);

    const response = await POST(
      new Request("https://aimarketcap.tech/api/provider-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ provider: "openrouter", token: "sk-or-v1-test1234" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(admin.inserted[0]).toMatchObject({
      user_id: "user-1",
      encrypted_secret: "v1.encrypted.envelope.value",
      secret_hint: "...1234",
    });
    expect(JSON.stringify(body)).not.toContain("sk-or-v1-test1234");
    expect(JSON.stringify(body)).not.toContain("encrypted.envelope");
  });
});
