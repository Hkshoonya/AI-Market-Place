# Phase 12: Component Testing Infrastructure - Research

**Researched:** 2026-03-08
**Domain:** Vitest jsdom + Testing Library + React 19 component testing
**Confidence:** HIGH

## Summary

Phase 12 adds component testing to the existing Vitest 4 test suite. The project already has Vitest 4.0.18 with 170+ node-environment tests (scoring, schemas, adapters). The challenge is adding jsdom-based component tests alongside these without breaking the existing setup. Vitest 4 removed `environmentMatchGlobs` -- the replacement is `projects` configuration which allows multiple test environments in one `vitest run` invocation.

The project uses React 19.2.3 and Next.js 16.1.6. The `@testing-library/react` v16 natively supports React 19 with no peer dependency overrides needed. Five target components have been identified: SearchDialog, MarketplaceFilterBar, RankingWeightControls, MarketTicker, and CommentsSection. Each requires different mocking strategies -- primarily `next/navigation`, `next/link`, `next/image`, Supabase client, auth context, and `fetch`.

**Primary recommendation:** Use Vitest 4 `projects` config to define two inline projects ("unit" for node env, "component" for jsdom env), install `@testing-library/react` v16 + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom` + `@vitejs/plugin-react`, and create a shared test setup file with Next.js module mocks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Vitest config extended with jsdom environment for component tests (environmentMatchGlobs preserves node for existing 170 tests) | Vitest 4 removed environmentMatchGlobs. Use `projects` config instead -- define "unit" project (node, `src/**/*.test.ts`) and "component" project (jsdom, `src/**/*.test.tsx`). Both run under single `vitest run`. |
| TEST-02 | Testing Library + React 19 integration verified (peer dep overrides if needed) | `@testing-library/react` v16.3.x natively supports React 19. No npm overrides needed. Install `@vitejs/plugin-react` for JSX transform in tests. |
| TEST-03 | Component tests written for 5+ high-value interactive components (search dialog, filter bar, ranking controls, market ticker, comments) | All 5 components analyzed. Each needs specific mocking: next/navigation (3 components), next/link (2), next/image (1), Supabase client (1), auth context (1), global fetch (4). Testing Library + userEvent covers all interaction patterns. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner | Already installed; supports projects config for multi-env |
| @testing-library/react | ^16.3 | Component rendering + queries | Official React Testing Library; v16 supports React 19 natively |
| @testing-library/jest-dom | ^6.6 | DOM assertion matchers | Provides toBeInTheDocument, toBeDisabled, etc.; has Vitest-specific import |
| @testing-library/user-event | ^14.6 | User interaction simulation | Superior to fireEvent; simulates real user actions (type, click, keyboard) |
| jsdom | ^26 | Browser environment simulation | Standard for Vitest component tests; provides DOM APIs in Node |
| @vitejs/plugin-react | ^4.3 | JSX/TSX transform for Vite | Required for Vitest to process JSX in component test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-tsconfig-paths | ^5.1 | Resolve @/ path alias in Vite | NOT needed -- existing vitest.config.ts already configures resolve.alias for @/ |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom | happy-dom | happy-dom is faster but missing some APIs (e.g., CSS computed styles). jsdom is the Next.js recommended default |
| @testing-library/user-event | fireEvent | fireEvent dispatches raw events; userEvent simulates full interaction sequences (focus, keydown, keyup, input). userEvent is more realistic |
| @vitejs/plugin-react | manual JSX config | Plugin handles SWC/Babel transform automatically; manual config is error-prone |

**Installation:**
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event @testing-library/dom @vitejs/plugin-react jsdom
```

Note: `@testing-library/dom` is a peer dependency of `@testing-library/react` v16 and must be explicitly installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    search-dialog.tsx
    search-dialog.test.tsx          # co-located component test
    marketplace/
      filter-bar.tsx
      filter-bar.test.tsx
    models/
      ranking-weight-controls.tsx
      ranking-weight-controls.test.tsx
      comments-section.tsx
      comments-section.test.tsx
    layout/
      market-ticker.tsx
      market-ticker.test.tsx
  test/
    setup-component.ts              # jsdom setup file (jest-dom matchers, cleanup, global mocks)
  lib/
    scoring/*.test.ts               # existing node-env tests (unchanged)
    schemas/*.test.ts               # existing node-env tests (unchanged)
```

### Pattern 1: Vitest 4 Projects Configuration (Mixed Environments)

**What:** Define two inline projects in vitest.config.ts -- one for existing node tests, one for new jsdom component tests.
**When to use:** When a single `vitest run` must execute tests across different environments.
**Example:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,  // inherits plugins + resolve from root
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          passWithNoTests: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup-component.ts'],
        },
      },
    ],
  },
});
```

**Key design decisions:**
- File extension convention: `.test.ts` = node environment, `.test.tsx` = jsdom environment. This is natural since component tests import JSX.
- `extends: true` so both projects inherit the root `plugins` (react) and `resolve.alias` (@/).
- Root-level `test` block is replaced entirely by `projects` -- no top-level `environment` or `include`.

### Pattern 2: Component Test Setup File

**What:** A setup file that extends Vitest with jest-dom matchers and configures automatic cleanup.
**When to use:** Every jsdom component test project.
**Example:**
```typescript
// src/test/setup-component.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock next/navigation globally for all component tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock next/link as a simple anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

// Mock next/image as a simple img
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
```

### Pattern 3: Per-Test Mock Overrides

**What:** Override global mocks for specific test cases that need custom behavior.
**When to use:** When a component test needs specific router state or search params.
**Example:**
```typescript
// filter-bar.test.tsx
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Override the global useSearchParams mock for this file
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams('?type=api_access&sort=newest'),
  usePathname: () => '/marketplace/browse',
}));

import { MarketplaceFilterBar } from './filter-bar';
```

### Pattern 4: Mocking Supabase Client

**What:** Mock the Supabase client for components that make direct DB calls (CommentsSection).
**When to use:** Any component that imports `createClient` from `@/lib/supabase/client`.
**Example:**
```typescript
// comments-section.test.tsx
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
            }),
          }),
        }),
      }),
    }),
    rpc: vi.fn(),
  }),
}));
```

### Pattern 5: Mocking Auth Context

**What:** Wrap components in a mock AuthProvider or mock the useAuth hook.
**When to use:** CommentsSection uses `useAuth()` for user state.
**Example:**
```typescript
// Mock the useAuth hook directly
vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    profile: { display_name: 'Test User', avatar_url: null, username: 'testuser' },
    loading: false,
    signOut: vi.fn(),
  }),
}));
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Do NOT assert on internal state, CSS classes, or component internals. Use role-based queries (getByRole, getByLabelText) and visible text.
- **Snapshot testing for interactive components:** Snapshots are brittle for components with dynamic state. Prefer behavioral assertions.
- **Not awaiting async updates:** Components with `useEffect` + `fetch` need `waitFor` or `findBy*` queries. Forgetting this causes flaky tests.
- **Mocking too deep:** Mock at module boundaries (next/navigation, supabase/client), not individual functions within your own code.
- **Using `getBy*` for elements that appear asynchronously:** Use `findBy*` (which internally uses waitFor) for elements that appear after state updates or async operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM queries | `document.querySelector` | `screen.getByRole`, `screen.getByText` | Testing Library queries match accessibility semantics; querySelector is brittle |
| User interactions | `fireEvent.click` / manual dispatch | `userEvent.click`, `userEvent.type` | userEvent simulates complete interaction chains (focus, pointer events, keyboard) |
| DOM matchers | Manual `expect(el.className).toContain()` | `toBeInTheDocument()`, `toBeDisabled()`, `toHaveTextContent()` | jest-dom matchers produce clear error messages |
| Async waiting | `setTimeout` / manual polling | `waitFor()`, `findBy*` queries | Testing Library manages retry logic and timeouts correctly |
| Next.js mocking | Custom router context providers | `vi.mock('next/navigation')` | Module-level mocks are simpler and work across all component depths |

**Key insight:** Testing Library's philosophy is "test what the user sees." Every query should map to something a user can perceive (role, text, label). This makes tests resilient to refactoring.

## Common Pitfalls

### Pitfall 1: Vitest 4 environmentMatchGlobs Removed
**What goes wrong:** Attempting to use `environmentMatchGlobs` (as specified in the original requirement description) fails silently or throws in Vitest 4.
**Why it happens:** Vitest 4.0.0 removed `environmentMatchGlobs` (deprecated since v3).
**How to avoid:** Use `projects` configuration with inline project definitions. Each project specifies its own `environment` and `include` glob.
**Warning signs:** "Unknown config option" warning or all tests running in wrong environment.

### Pitfall 2: @testing-library/react v16 Requires Explicit @testing-library/dom
**What goes wrong:** `npm install @testing-library/react` succeeds but imports fail with "cannot find module @testing-library/dom".
**Why it happens:** v16 moved `@testing-library/dom` to a peer dependency instead of bundling it.
**How to avoid:** Explicitly install `@testing-library/dom` alongside `@testing-library/react`.
**Warning signs:** Module resolution errors on import.

### Pitfall 3: Missing @vitejs/plugin-react Causes JSX Parse Errors
**What goes wrong:** Component test `.tsx` files fail with "Unexpected token <" or similar JSX parse errors.
**Why it happens:** Without the React Vite plugin, Vitest cannot transform JSX in test files.
**How to avoid:** Install `@vitejs/plugin-react` and add it to the `plugins` array in vitest.config.ts.
**Warning signs:** SyntaxError on first JSX element in any test file.

### Pitfall 4: styled-jsx in MarketTicker Component
**What goes wrong:** MarketTicker uses `<style jsx>` (Next.js styled-jsx) which jsdom does not understand natively.
**Why it happens:** styled-jsx requires a Babel/SWC transform that is not active in Vitest.
**How to avoid:** The `@vitejs/plugin-react` plugin handles styled-jsx transformation. If warnings about `jsx` attribute appear, they are cosmetic and do not break tests. Test behavior (items rendered, links working) rather than CSS animation.
**Warning signs:** Console warning about `true` for non-boolean attribute `jsx`.

### Pitfall 5: Async Component State Updates Not Awaited
**What goes wrong:** Tests pass locally but fail in CI, or assertions run before state updates complete.
**Why it happens:** Components that fetch data in `useEffect` update state asynchronously. `getBy*` queries run synchronously.
**How to avoid:** Use `findBy*` queries (auto-retry with waitFor) for elements that appear after async operations. Use `waitFor` for assertion blocks that depend on state changes.
**Warning signs:** Tests intermittently failing, "element not found" for elements that should exist.

### Pitfall 6: Module-Level Side Effects in Component Files
**What goes wrong:** CommentsSection creates a Supabase client at module scope (`const supabase = createClient()`), which runs during import before mocks are set up.
**Why it happens:** `vi.mock()` is hoisted above imports, but only for the mock declaration. If the module being imported has module-level side effects that reference environment variables, they execute during import.
**How to avoid:** `vi.mock('@/lib/supabase/client')` is hoisted, so the mock IS in place when the component module loads. Verify that `createClient` mock returns the expected chainable interface.
**Warning signs:** Errors about undefined NEXT_PUBLIC_SUPABASE_URL.

### Pitfall 7: projects Config Not Inheriting Root Plugins
**What goes wrong:** Component tests fail with JSX errors even though `@vitejs/plugin-react` is in the root config.
**Why it happens:** Vitest projects do NOT inherit root config by default. You must set `extends: true` on each project.
**How to avoid:** Always set `extends: true` on inline project definitions that need root plugins and resolve aliases.
**Warning signs:** JSX parse errors only in component tests, not in the config itself.

## Code Examples

### Example 1: Search Dialog Test (Render + Interaction)
```typescript
// src/components/search-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock fetch for search API
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

import { SearchDialog } from './search-dialog';

describe('SearchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders trigger button', () => {
    render(<SearchDialog />);
    expect(screen.getByLabelText('Open search dialog (Ctrl+K)')).toBeInTheDocument();
  });

  it('opens dialog on button click', async () => {
    const user = userEvent.setup();
    render(<SearchDialog />);

    await user.click(screen.getByLabelText('Open search dialog (Ctrl+K)'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Search AI models and marketplace')).toBeInTheDocument();
  });

  it('displays results after typing', async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({
        data: [{ id: '1', slug: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', category: 'llm', overall_rank: 1, quality_score: 95 }],
        marketplace: [],
      }),
    } as Response);

    render(<SearchDialog />);
    await user.click(screen.getByLabelText('Open search dialog (Ctrl+K)'));
    await user.type(screen.getByLabelText('Search AI models and marketplace'), 'GPT');

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
  });

  it('navigates to model on result click', async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({
        data: [{ id: '1', slug: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', category: 'llm', overall_rank: 1, quality_score: 95 }],
        marketplace: [],
      }),
    } as Response);

    render(<SearchDialog />);
    await user.click(screen.getByLabelText('Open search dialog (Ctrl+K)'));
    await user.type(screen.getByLabelText('Search AI models and marketplace'), 'GPT');

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    await user.click(screen.getByText('GPT-4'));
    expect(mockPush).toHaveBeenCalledWith('/models/gpt-4');
  });
});
```

### Example 2: RankingWeightControls Test (State Logic)
```typescript
// src/components/models/ranking-weight-controls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RankingWeightControls from './ranking-weight-controls';

const mockModels = [
  {
    name: 'GPT-4', slug: 'gpt-4', provider: 'OpenAI', category: 'llm',
    overall_rank: 1, category_rank: 1, quality_score: 95, value_score: 80,
    is_open_weights: false, hf_downloads: null, popularity_score: 90,
    agent_score: 85, agent_rank: 1, popularity_rank: 1,
    market_cap_estimate: 1000000, capability_score: 92,
    capability_rank: 1, usage_score: 88, usage_rank: 1,
    expert_score: 91, expert_rank: 1, balanced_rank: 1,
  },
];

describe('RankingWeightControls', () => {
  it('renders toggle button', () => {
    render(<RankingWeightControls models={mockModels} onSortedModels={vi.fn()} />);
    expect(screen.getByText('Customize Rankings')).toBeInTheDocument();
  });

  it('shows weight controls when expanded', async () => {
    const user = userEvent.setup();
    render(<RankingWeightControls models={mockModels} onSortedModels={vi.fn()} />);

    await user.click(screen.getByText('Customize Rankings'));

    expect(screen.getByText('HumanEval Score')).toBeInTheDocument();
    expect(screen.getByText('Market Cap')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
  });

  it('calls onSortedModels when weight changes', async () => {
    const user = userEvent.setup();
    const onSortedModels = vi.fn();
    render(<RankingWeightControls models={mockModels} onSortedModels={onSortedModels} />);

    await user.click(screen.getByText('Customize Rankings'));
    await user.click(screen.getByLabelText('Increase HumanEval Score weight'));

    expect(onSortedModels).toHaveBeenCalled();
  });
});
```

### Example 3: MarketTicker Test (Fetch + Render)
```typescript
// src/components/layout/market-ticker.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarketTicker } from './market-ticker';

describe('MarketTicker', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('renders nothing when no data', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ([]),
    } as Response);

    const { container } = render(<MarketTicker />);
    // Component returns null when items.length === 0
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders ticker items with scores', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ([
        { name: 'GPT-4', slug: 'gpt-4', provider: 'OpenAI', score: 95.2, delta: 2.1, rank: 1 },
        { name: 'Claude', slug: 'claude-3', provider: 'Anthropic', score: 93.8, delta: -1.3, rank: 2 },
      ]),
    } as Response);

    render(<MarketTicker />);

    await waitFor(() => {
      // Items are doubled for seamless loop, so multiple instances exist
      expect(screen.getAllByText('GPT-4').length).toBeGreaterThan(0);
      expect(screen.getAllByText('95.2').length).toBeGreaterThan(0);
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `environmentMatchGlobs` for mixed envs | `projects` config with inline definitions | Vitest 3.2 (deprecated) / 4.0 (removed) | Must use projects; existing config must change |
| `workspace` file (vitest.workspace.ts) | `projects` key in vitest.config.ts | Vitest 3.2 | No separate workspace file needed |
| `@testing-library/react` v14-15 | v16 with explicit `@testing-library/dom` peer | 2024 | Must install @testing-library/dom separately |
| npm overrides for React 19 peer deps | @testing-library/react v16 supports React 19 natively | 2025 | No overrides needed |
| `@testing-library/jest-dom` manual extend | Import `@testing-library/jest-dom/vitest` | jest-dom v6 | Vitest-specific import auto-extends expect |

**Deprecated/outdated:**
- `environmentMatchGlobs`: Removed in Vitest 4. Use `projects` instead.
- `workspace` config: Renamed to `projects` in Vitest 3.2.
- `poolMatchGlobs`: Removed in Vitest 4.
- `@testing-library/react` v14/v15: Use v16 for React 19 support.

## Open Questions

1. **styled-jsx Warning in MarketTicker**
   - What we know: `@vitejs/plugin-react` should handle the transform. Some users report a cosmetic warning about `jsx` attribute.
   - What's unclear: Whether the warning appears with the latest plugin-react version.
   - Recommendation: Test during implementation. If warning appears, it is non-blocking (test behavior, not CSS). Can suppress with `console.warn` filter in setup file if needed.

2. **globals: false vs globals: true**
   - What we know: Existing tests use `globals: false` (explicit imports from vitest). Next.js docs suggest `globals: true`.
   - What's unclear: Whether jest-dom matchers require `globals: true`.
   - Recommendation: Keep `globals: false` for consistency with existing tests. The `@testing-library/jest-dom/vitest` import extends `expect` automatically regardless of globals setting.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (exists, needs modification) |
| Quick run command | `npx vitest run --project component` |
| Full suite command | `npx vitest run` (runs both unit + component projects) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Vitest projects config runs both node + jsdom tests | smoke | `npx vitest run` (verify exit 0, both projects execute) | No -- Wave 0 |
| TEST-02 | Testing Library renders React 19 component without errors | smoke | `npx vitest run --project component` (verify no peer dep warnings) | No -- Wave 0 |
| TEST-03a | SearchDialog render + interaction tests | component | `npx vitest run src/components/search-dialog.test.tsx` | No -- implementation |
| TEST-03b | FilterBar render + interaction tests | component | `npx vitest run src/components/marketplace/filter-bar.test.tsx` | No -- implementation |
| TEST-03c | RankingWeightControls render + interaction tests | component | `npx vitest run src/components/models/ranking-weight-controls.test.tsx` | No -- implementation |
| TEST-03d | MarketTicker render + data display tests | component | `npx vitest run src/components/layout/market-ticker.test.tsx` | No -- implementation |
| TEST-03e | CommentsSection render + interaction tests | component | `npx vitest run src/components/models/comments-section.test.tsx` | No -- implementation |

### Sampling Rate
- **Per task commit:** `npx vitest run` (full suite, both projects)
- **Per wave merge:** `npx vitest run` + `npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install dev dependencies: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@testing-library/dom`, `@vitejs/plugin-react`, `jsdom`
- [ ] `src/test/setup-component.ts` -- jest-dom matchers, cleanup, Next.js module mocks
- [ ] `vitest.config.ts` -- rewrite to use `projects` configuration (two inline projects)
- [ ] Verify existing 170+ node tests still pass after config change

## Sources

### Primary (HIGH confidence)
- [Next.js Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) -- Official Next.js 16.1.6 Vitest setup guide (packages, config, examples)
- [Vitest 4.0.0 Release Notes](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0) -- Confirmed environmentMatchGlobs removal
- [Vitest Migration Guide](https://vitest.dev/guide/migration.html) -- projects replaces workspace and environmentMatchGlobs
- [Vitest Test Projects](https://vitest.dev/guide/projects) -- inline project definition syntax with extends
- [Vitest Environment Guide](https://vitest.dev/guide/environment) -- per-file `// @vitest-environment jsdom` directive as alternative

### Secondary (MEDIUM confidence)
- [npm @testing-library/react](https://www.npmjs.com/package/@testing-library/react) -- v16.3.x confirmed React 19 support, @testing-library/dom as peer dep
- [Using jest-dom with Vitest](https://markus.oberlehner.net/blog/using-testing-library-jest-dom-with-vitest) -- `@testing-library/jest-dom/vitest` import pattern
- [Next.js Discussion #42527](https://github.com/vercel/next.js/discussions/42527) -- Patterns for mocking next/navigation in tests
- [styled-jsx Issue #838](https://github.com/vercel/styled-jsx/issues/838) -- jsx attribute warning in test environments

### Tertiary (LOW confidence)
- WebSearch results on styled-jsx + vitest interaction -- limited specific guidance found; recommend testing during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Official Next.js docs + npm package pages confirm all versions and compatibility
- Architecture: HIGH -- Vitest 4 projects config verified via release notes and migration guide; patterns from official docs
- Pitfalls: HIGH -- environmentMatchGlobs removal confirmed; peer dep requirement confirmed; other pitfalls from direct source analysis
- Component mocking strategies: MEDIUM -- Based on component source code analysis + community patterns; will need validation during implementation

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (30 days -- stable ecosystem, no rapid changes expected)
