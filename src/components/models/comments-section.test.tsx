/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { CommentsSection } from './comments-section';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so variables are available in hoisted vi.mock factories
// ---------------------------------------------------------------------------

const { mockUseAuth, mockSupabaseFrom, mockFetch } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockFetch: vi.fn(),
}));

// Chainable Supabase query builder mock
function createChainMock(resolvedValue: { data: unknown; error: null }) {
  const chain: any = {};
  const methods = ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update', 'delete'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // The last call in the chain resolves via `then` (SupabaseClient returns a thenable)
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

// Mock auth provider
vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
    rpc: vi.fn(),
  }),
}));

vi.stubGlobal('fetch', mockFetch);

// Mock parseQueryResult to pass data through
vi.mock('@/lib/schemas/parse', () => ({
  parseQueryResult: (response: any) => response?.data ?? [],
}));

// Mock CommentSchema from community
vi.mock('@/lib/schemas/community', () => ({
  CommentSchema: {},
}));

// Mock formatRelativeDate
vi.mock('@/lib/format', () => ({
  formatRelativeDate: () => 'just now',
  formatNumber: (n: any) => String(n),
  formatCurrency: (n: any) => `$${n}`,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Edit3: (props: any) => <span {...props} />,
  MessageSquare: (props: any) => <span {...props} />,
  Send: (props: any) => <span {...props} />,
  ThumbsUp: (props: any) => <span {...props} />,
  Trash2: (props: any) => <span {...props} />,
  X: (props: any) => <span {...props} />,
}));

// Mock shadcn UI card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

// Mock shadcn Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockComments = [
  {
    id: 'comment-1',
    model_id: 'test-model-id',
    user_id: 'user-1',
    parent_id: null,
    content: 'This model is excellent for code generation.',
    upvotes: 5,
    is_edited: false,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'comment-2',
    model_id: 'test-model-id',
    user_id: 'user-2',
    parent_id: null,
    content: 'Great benchmark scores overall.',
    upvotes: 2,
    is_edited: false,
    created_at: '2026-03-02T14:00:00Z',
    updated_at: '2026-03-02T14:00:00Z',
  },
];

const mockProfiles = [
  { id: 'user-1', display_name: 'Alice', avatar_url: null, username: 'alice' },
  { id: 'user-2', display_name: 'Bob', avatar_url: null, username: 'bob' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupSupabaseMock(comments: typeof mockComments, profiles: typeof mockProfiles) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'comments') {
      return createChainMock({ data: comments, error: null });
    }
    if (table === 'profiles') {
      return createChainMock({ data: profiles, error: null });
    }
    return createChainMock({ data: [], error: null });
  });

  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/model-comments?')) {
      const topLevel = comments.filter((comment) => comment.parent_id === null);
      const topLevelIds = new Set(topLevel.map((comment) => comment.id));
      const replies = comments.filter(
        (comment) => comment.parent_id && topLevelIds.has(comment.parent_id)
      );
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const replyMap = new Map<string, any[]>();

      for (const reply of replies) {
        const existing = replyMap.get(reply.parent_id!) ?? [];
        existing.push({
          ...reply,
          profiles: profileMap.get(reply.user_id) ?? null,
          replies: [],
        });
        replyMap.set(reply.parent_id!, existing);
      }

      return Promise.resolve(
        makeJsonResponse({
          comments: topLevel.map((comment) => ({
            ...comment,
            profiles: profileMap.get(comment.user_id) ?? null,
            replies: replyMap.get(comment.id) ?? [],
          })),
        })
      );
    }

    return Promise.resolve(makeJsonResponse({ comments: [] }));
  });
}

function makeJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('shows loading state initially, then renders comments after fetch', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });
    setupSupabaseMock(mockComments, mockProfiles);

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><CommentsSection modelId="test-model-id" /></SWRConfig>);

    // Loading state shown initially
    expect(screen.getByText('Loading comments...')).toBeInTheDocument();

    // After fetch resolves, comments should appear
    await waitFor(() => {
      expect(screen.getByText('This model is excellent for code generation.')).toBeInTheDocument();
    });

    expect(screen.getByText('Great benchmark scores overall.')).toBeInTheDocument();
  });

  it('shows "Sign in" prompt when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });
    setupSupabaseMock([], []);

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><CommentsSection modelId="test-model-id" /></SWRConfig>);

    // The sign-in link should be present
    const signInLink = screen.getByText('Sign in');
    expect(signInLink).toBeInTheDocument();
    expect(signInLink.closest('a')).toHaveAttribute('href', '/login');

    // Comment textarea should NOT be present
    expect(
      screen.queryByPlaceholderText('Share your thoughts on this model...')
    ).not.toBeInTheDocument();
  });

  it('shows comment input textarea when user is authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'alice@test.com' },
      profile: { display_name: 'Alice', avatar_url: null, username: 'alice' },
      loading: false,
      signOut: vi.fn(),
    });
    setupSupabaseMock(mockComments, mockProfiles);

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><CommentsSection modelId="test-model-id" /></SWRConfig>);

    // Comment textarea should be visible for authenticated users
    expect(
      screen.getByPlaceholderText('Share your thoughts on this model...')
    ).toBeInTheDocument();

    // Post button should be present
    expect(screen.getByText('Post')).toBeInTheDocument();

    // Sign in prompt should NOT be shown
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });

  it('renders comment content and author names from fetched data', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });
    setupSupabaseMock(mockComments, mockProfiles);

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><CommentsSection modelId="test-model-id" /></SWRConfig>);

    // Wait for comments to load
    await waitFor(() => {
      expect(screen.getByText('This model is excellent for code generation.')).toBeInTheDocument();
    });

    // Author names should be rendered
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Timestamps should be rendered (mocked as "just now")
    const timestamps = screen.getAllByText('just now');
    expect(timestamps.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "No comments yet" when fetch returns empty array', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });
    setupSupabaseMock([], []);

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><CommentsSection modelId="test-model-id" /></SWRConfig>);

    // Wait for loading to finish and check empty state
    await waitFor(() => {
      expect(
        screen.getByText('No comments yet. Be the first to share your thoughts!')
      ).toBeInTheDocument();
    });
  });

  it('posts a new comment and updates the list immediately', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'alice@test.com', user_metadata: {} },
      profile: { display_name: 'Alice', avatar_url: null, username: 'alice' },
      loading: false,
      signOut: vi.fn(),
    });

    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/model-comments?')) {
        return Promise.resolve(makeJsonResponse({ comments: [] }));
      }
      if (url === '/api/model-comments' && init?.method === 'POST') {
        return Promise.resolve(
          makeJsonResponse(
            {
              comment: {
                id: 'comment-new',
                model_id: 'test-model-id',
                user_id: 'user-1',
                parent_id: null,
                content: 'Fresh discussion post',
                upvotes: 0,
                is_edited: false,
                created_at: '2026-03-30T12:00:00Z',
                updated_at: '2026-03-30T12:00:00Z',
                profiles: {
                  display_name: 'Alice',
                  avatar_url: null,
                  username: 'alice',
                },
                replies: [],
              },
            },
            true,
            201
          )
        );
      }
      return Promise.resolve(makeJsonResponse({ comments: [] }));
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CommentsSection modelId="test-model-id" />
      </SWRConfig>
    );

    await waitFor(() => {
      expect(
        screen.getByText('No comments yet. Be the first to share your thoughts!')
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Share your thoughts on this model...'), {
      target: { value: 'Fresh discussion post' },
    });
    fireEvent.click(screen.getByText('Post'));

    await waitFor(() => {
      expect(screen.getByText('Fresh discussion post')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/model-comments',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });
});
