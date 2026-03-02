# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Status:** Not detected

**Findings:**
- No test configuration files found (jest.config.*, vitest.config.*, etc.)
- No test dependencies in `package.json` (vitest, jest, @testing-library/react, etc.)
- No test files (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx) found in `src/`
- No test scripts in `package.json` (only: dev, build, start, lint)

**Implication:** Testing patterns are not yet established in this codebase. Tests will need to be added during development.

## Recommended Testing Approach

Based on the tech stack (Next.js 16, React 19, TypeScript), the following frameworks are recommended:

**Runner:**
- Option 1: Vitest (lightweight, ES module native, faster)
- Option 2: Jest (widely used, mature ecosystem)

**Assertion Library:**
- Built-in: Node assertions or Vitest assertions
- Enhanced: Chai, Expect, or @testing-library/react assertions

**Testing Libraries for UI:**
- @testing-library/react - for component testing
- @testing-library/jest-dom - for DOM matchers

**Coverage Tool:**
- Built into Vitest or Jest (--coverage flag)

## Current Code Quality Indicators

While formal tests are absent, the codebase shows testing-friendly patterns:

**Type Safety:**
- Strict TypeScript (`"strict": true` in tsconfig.json)
- Interfaces well-defined for all major types
- Type imports used explicitly

**Error Handling:**
- Explicit error handling in async functions (try-catch in `src/components/auth/auth-provider.tsx`)
- Error response objects typed (`{ valid: boolean; error?: string; keyRecord: ... }`)
- HTTP error status codes properly set in API routes

**Code Organization:**
- Separation of concerns (components, hooks, lib utilities)
- Pure functions common (see `src/lib/agents/auth.ts` - `generateApiKey`, `hashApiKey` are side-effect free)
- Context/provider pattern for state (AuthProvider in `src/components/auth/auth-provider.tsx`)

## Suggested Test Areas (by Priority)

### High Priority (Core Business Logic)

**1. Authentication & Authorization**
- Files: `src/middleware.ts`, `src/lib/agents/auth.ts`, `src/components/auth/auth-provider.tsx`
- Test cases:
  - API key generation produces valid format (`aimk_` prefix + 32 random bytes)
  - API key hashing produces consistent SHA-256 hash
  - API key validation rejects invalid format
  - API key validation rejects expired keys
  - Middleware redirects unauthenticated users to `/login`
  - Middleware blocks non-admin users from `/admin/` routes
  - AuthProvider fetches and caches user profile on mount
  - AuthProvider subscribes to auth state changes

**2. API Routes**
- Files: `src/app/api/*/route.ts`
- Test cases:
  - Rate limiting enforces limits and returns 429 status
  - Unauthorized requests return 401 status
  - GET requests return correct data shape
  - Error handling returns 500 with error message

**3. Utility Functions**
- File: `src/hooks/use-debounce.ts`
- Test cases:
  - Hook delays value updates by specified delay
  - Hook clears timeout on unmount
  - Changing delay updates timer

### Medium Priority (Component Behavior)

**4. Auth Components**
- File: `src/components/auth/auth-button.tsx`
- Test cases:
  - Shows "Sign In" link when user is null
  - Shows user dropdown when user is authenticated
  - Dropdown displays user display_name or email
  - Sign out calls signOut function

**5. Chart Components**
- Files: `src/components/charts/*.tsx`
- Test cases:
  - ChartCard renders with title and children
  - ChartCard shows loading state
  - ChartCard shows empty message when no data
  - Fullscreen toggle works

### Low Priority (Snapshot/Display)

**6. UI Components**
- shadcn components (tested by library)
- Page layouts and navigation

## Test Structure (When Implemented)

**Recommended file placement:**
- Co-located with source: `src/lib/agents/auth.ts` → `src/lib/agents/auth.test.ts`
- Or parallel structure: `src/__tests__/lib/agents/auth.test.ts`

**Example test structure (for Vitest):**

```typescript
// src/lib/agents/auth.test.ts
import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, validateApiKey } from "./auth";

describe("API Key Generation", () => {
  it("should generate key with correct prefix", () => {
    const { plaintext } = generateApiKey();
    expect(plaintext).toMatch(/^aimk_/);
  });

  it("should generate unique keys", () => {
    const key1 = generateApiKey().plaintext;
    const key2 = generateApiKey().plaintext;
    expect(key1).not.toBe(key2);
  });
});

describe("API Key Hashing", () => {
  it("should produce consistent hash for same key", () => {
    const key = "test-key";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });
});

describe("API Key Validation", () => {
  it("should reject keys without prefix", async () => {
    const result = await validateApiKey(mockSupabase, "invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid key format");
  });
});
```

**Example component test (with @testing-library/react):**

```typescript
// src/components/auth/auth-button.test.tsx
import { render, screen } from "@testing-library/react";
import { AuthButton } from "./auth-button";
import { useAuth } from "./auth-provider";

vi.mock("./auth-provider");

describe("AuthButton", () => {
  it("should show Sign In link when not authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(<AuthButton />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("should show user profile when authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "123", email: "test@example.com" } as any,
      profile: { display_name: "Test User" } as any,
      loading: false,
      signOut: vi.fn(),
    });

    render(<AuthButton />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});
```

## Mocking Patterns (When Tests Are Added)

**Mocking Supabase:**
- Mock the `supabase` client returned by `createClient()`
- Mock responses with `{ data, error }` shape
- Use dependency injection or vi.mock() for module-level singletons

**Mocking React Hooks:**
- Use `vi.mocked()` with Vitest
- Mock hook return values in test setup

**What NOT to Mock:**
- TypeScript type definitions (they don't exist at runtime)
- Pure utility functions (test them directly)
- Built-in functions (useState, useEffect, etc. - test through component behavior)

## Coverage Goals (Suggested)

- **Statements:** 70% minimum (core logic prioritized)
- **Branches:** 60% minimum (main paths covered)
- **Functions:** 75% minimum (utilities and handlers tested)
- **Lines:** 70% minimum

Priority: Focus on business logic and error paths before UI coverage.

## ESLint & Code Quality

**Current Setup:**
- ESLint 9 with Next.js config: enforces best practices
- TypeScript strict mode: prevents type errors
- No explicit test configuration, but infrastructure is TypeScript-first

**Before Adding Tests:**
1. Install test framework: `npm install -D vitest @testing-library/react`
2. Create vitest.config.ts with Next.js/React configuration
3. Create test utilities (setup file, custom render functions)
4. Add test script to package.json: `"test": "vitest"`

---

*Testing analysis: 2026-03-02*

**Note:** This codebase is currently without automated tests. The recommendations above provide a roadmap for adding tests as development progresses. Priority should be given to testing authentication, API routes, and critical business logic utilities.
