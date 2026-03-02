# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- React components: kebab-case (`auth-button.tsx`, `chart-card.tsx`)
- Utility/service files: kebab-case (`use-debounce.ts`, `auth.ts`)
- API routes: match directory structure (`/api/activity/route.ts`)
- Type definition files: descriptive names (`types.ts`, `database.ts`)

**Functions:**
- Exported functions: camelCase (`generateApiKey`, `validateApiKey`, `useAuth`, `fetchProfile`)
- React hooks: camelCase with `use` prefix (`useAuth`, `useDebounce`)
- Private/internal functions: camelCase (`isProtectedRoute`, `isAdminRoute`, `getClientIp`)
- Server/async functions: camelCase (`createClient`, `findOrCreateConversation`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (`KEY_PREFIX`, `PROTECTED_ROUTES`, `RATE_LIMITS`)
- Local variables: camelCase (`displayName`, `avatarUrl`, `debouncedValue`)
- Boolean variables: descriptive with `is`/`has`/`can` prefix (`isAdmin`, `isLoading`, `isFullscreen`, `loading`)
- Database columns: snake_case in types (`display_name`, `avatar_url`, `is_admin`, `seller_verified`)

**Types:**
- Interfaces: PascalCase (`AuthContextType`, `ChartCardProps`, `Profile`, `AgentRecord`, `MarketplaceListing`)
- Type aliases: PascalCase (`ModelCategory`, `AgentStatus`, `OrderStatus`)
- Union types: snake_case members (`"llm" | "image_generation" | "vision"`)

## Code Style

**Formatting:**
- Tool: ESLint 9 with Next.js config (no Prettier detected)
- Line length: Not explicitly configured, but code follows reasonable margins
- Indentation: 2 spaces (observed in tsconfig, eslint config)

**Linting:**
- Tool: ESLint 9 with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config file: `eslint.config.mjs` (flat config format)
- Key rules applied:
  - Core Web Vitals linting
  - TypeScript strict checking
  - Next.js best practices
  - React ESM imports

**TypeScript Configuration:**
- Target: ES2017
- Strict mode: enabled
- Module resolution: bundler
- JSX: react-jsx (React 17+ automatic JSX transform)
- Path aliases configured: `@/*` → `./src/*`

## Import Organization

**Order:**
1. External dependencies from node_modules (`react`, `next`, `@supabase/...`)
2. Type imports (`type { ... } from "..."`)
3. Internal imports using path aliases (`from "@/..."`)
4. Internal imports from sibling/parent directories (rarely used)

**Examples:**
```typescript
// Correct order
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";
import type { User } from "@supabase/supabase-js";
```

**Path Aliases:**
- Primary: `@/*` maps to `./src/*`
- Used throughout for clean imports: `@/components/...`, `@/lib/...`, `@/hooks/...`, `@/types/...`

## Error Handling

**Patterns:**
- Async/await with try-catch for initialization: See `src/components/auth/auth-provider.tsx` lines 68-82
- Supabase errors: Check `error` property from response objects
  ```typescript
  const { data, error } = await supabase.from("...").select();
  if (error) {
    console.warn("Operation failed:", error.message);
    return null;
  }
  ```
- Return-based error handling: Use typed return objects with `error` property
  ```typescript
  // From src/lib/agents/auth.ts
  return { valid: false, keyRecord: null, error: "Invalid key format" };
  ```
- HTTP error responses: Use Next.js `NextResponse.json()` with status codes
  ```typescript
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(data, { status: 429, headers: rateLimitHeaders(rl) });
  ```
- Graceful logging: Use `console.warn()` for non-critical failures

## Logging

**Framework:** console (built-in)

**Patterns:**
- Info/debug: `console.log()` (inferred)
- Warnings: `console.warn("message:", details)` - for recoverable errors
- Example: `console.warn("Profile fetch failed:", error.message);`
- Agent logging: Dedicated `AgentLogger` interface in `src/lib/agents/types.ts` with async methods
  - Methods: `debug()`, `info()`, `warn()`, `error()`
  - Signature: `async (message: string, metadata?: Record<string, unknown>): Promise<void>`

## Comments

**When to Comment:**
- Module-level documentation: Multiline JSDoc-style at file top (see `src/lib/agents/auth.ts`)
- Complex logic: Inline comments explaining "why" not "what" (see `src/middleware.ts` line 44)
- Database/API concerns: Comments on side effects (see `src/lib/agents/auth.ts` line 72: "fire and forget")

**JSDoc/TSDoc:**
- Used for exported functions and complex utilities
- Document parameters, return types, and purpose
- Example:
  ```typescript
  /** Generate a new API key. Returns the plaintext key (show once) and its hash. */
  export function generateApiKey(): { plaintext: string; hash: string; prefix: string }

  /** Validate an API key and return the key record if valid */
  export async function validateApiKey(...)
  ```

**ESLint Disable Comments:**
- Used sparingly: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Applied when type safety must be relaxed for framework compatibility (Supabase client typing)

## Function Design

**Size:** Functions are concise and focused
- Single responsibility per function
- Utility functions: 5-30 lines (see `useDebounce` in `src/hooks/use-debounce.ts`)
- Component functions: 30-120 lines with JSX (see `AuthButton` in `src/components/auth/auth-button.tsx`)

**Parameters:**
- Props interfaces defined inline or as separate types
- Destructured in function signature for readability
- Example: `({ title, subtitle, children, controls, className = "", minHeight = 400, ... }: ChartCardProps)`
- Default values: provided in destructuring
- Object params for optional/complex inputs

**Return Values:**
- Typed explicitly in function signature
- Async functions return `Promise<T>`
- Hooks return single value or object with multiple values
- Server functions return `NextResponse` (API routes)

## Module Design

**Exports:**
- Named exports for functions/components: `export function ComponentName()` or `export const functionName = () => {}`
- Type exports: `export interface/type Name`
- Single default export rarely used (no evidence in codebase)

**Barrel Files:**
- Not heavily used; imports are direct
- Example: `import { Button } from "@/components/ui/button"` (shadcn components)

**File Structure by Layer:**
- `src/components/`: React components (UI and features)
- `src/lib/`: Utilities, helpers, services (no layer subdirectories like "services")
- `src/hooks/`: Custom React hooks
- `src/types/`: TypeScript type definitions and interfaces
- `src/app/`: Next.js app router pages and API routes
- `src/middleware.ts`: Request middleware

**Component Patterns:**
- Server components: No `"use client"` directive (default in app router)
- Client components: Marked with `"use client"` at top (see `src/components/auth/auth-button.tsx` line 1)
- Props interface defined above component:
  ```typescript
  interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    // ... more props
  }

  export function ChartCard({ ... }: ChartCardProps) { ... }
  ```

**State Management:**
- React hooks: `useState`, `useEffect`, `useContext` for client state
- Context API: `useAuth()` hook wraps context consumption
- No Redux/Zustand detected; simple React patterns sufficient

---

*Convention analysis: 2026-03-02*
