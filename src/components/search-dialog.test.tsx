import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import { jsonFetcher } from '@/lib/swr/fetcher';
import { SearchDialog } from './search-dialog';

// Override next/navigation mock to capture router.push calls
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
  ShoppingBag: (props: any) => <span data-testid="shopping-icon" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-icon" {...props} />,
}));

// Mock categories to avoid pulling in full icon set
vi.mock('@/lib/constants/categories', () => ({
  CATEGORY_MAP: {},
  CATEGORIES: [],
}));

describe('SearchDialog', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default fetch mock returns empty
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], marketplace: [] }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button with accessible label', () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);
    const button = screen.getByRole('button', {
      name: /open search dialog/i,
    });
    expect(button).toBeInTheDocument();
  });

  it('opens dialog on trigger button click and shows search input', async () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);
    const trigger = screen.getByRole('button', {
      name: /open search dialog/i,
    });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const input = screen.getByRole('combobox', {
      name: /search ai models and marketplace/i,
    });
    expect(input).toBeInTheDocument();
  });

  it('displays model results after typing a query', async () => {
    const mockResults = [
      {
        id: '1',
        slug: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        category: 'llm',
        overall_rank: 1,
        quality_score: 92.5,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResults, marketplace: [] }),
      })
    );

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);

    // Open dialog
    await user.click(
      screen.getByRole('button', { name: /open search dialog/i })
    );

    // Type a search query (>= 2 chars to trigger search)
    const input = screen.getByRole('combobox');
    await user.type(input, 'gpt');

    // Wait for debounced results
    await waitFor(() => {
      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    });

    // Check provider text is rendered
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
  });

  it('displays marketplace results alongside model results when API returns both', async () => {
    const mockModels = [
      {
        id: '1',
        slug: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        category: 'llm',
        overall_rank: 1,
        quality_score: 92.5,
      },
    ];
    const mockMarketplace = [
      {
        id: '2',
        slug: 'gpt-4-api',
        title: 'GPT-4 API Access',
        listing_type: 'api_access',
        price: 29.99,
        avg_rating: 4.5,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockModels,
          marketplace: mockMarketplace,
        }),
      })
    );

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);
    await user.click(
      screen.getByRole('button', { name: /open search dialog/i })
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'gpt');

    // Wait for model results
    await waitFor(() => {
      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    });

    // Marketplace result also visible
    expect(screen.getByText('GPT-4 API Access')).toBeInTheDocument();
  });

  it('navigates to /models/{slug} via router.push when a model result is clicked', async () => {
    const mockResults = [
      {
        id: '1',
        slug: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        category: 'llm',
        overall_rank: 1,
        quality_score: 92.5,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResults, marketplace: [] }),
      })
    );

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);
    await user.click(
      screen.getByRole('button', { name: /open search dialog/i })
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'gpt');

    // Wait for result to appear then click it
    const resultButton = await screen.findByText('GPT-4o');
    await user.click(resultButton);

    expect(mockPush).toHaveBeenCalledWith('/models/gpt-4o');
  });

  it('shows no results message when search returns empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], marketplace: [] }),
      })
    );

    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: jsonFetcher }}><SearchDialog /></SWRConfig>);
    await user.click(
      screen.getByRole('button', { name: /open search dialog/i })
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'xyznotfound');

    await waitFor(() => {
      expect(
        screen.getByText(/no results found/i)
      ).toBeInTheDocument();
    });
  });
});
