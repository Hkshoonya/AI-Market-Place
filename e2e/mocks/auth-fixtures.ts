export const mockUser = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e-test@example.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
  phone: "",
  confirmed_at: "2024-01-01T00:00:00Z",
  last_sign_in_at: "2024-01-01T00:00:00Z",
  app_metadata: {
    provider: "email",
    providers: ["email"],
  },
  user_metadata: {
    full_name: "E2E Tester",
  },
  identities: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const mockProfile = {
  id: mockUser.id,
  username: "e2e-tester",
  display_name: "E2E Tester",
  avatar_url: null,
  bio: null,
  is_admin: false,
  is_seller: false,
  seller_verified: false,
  joined_at: "2024-01-01T00:00:00Z",
  reputation_score: 88,
};

export function buildMockSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  return {
    access_token: "mock-access-token-for-e2e-testing",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token-for-e2e-testing",
    user: mockUser,
  };
}
