import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { MarketTicker } from './market-ticker';

// Mock styled-jsx to avoid warnings
vi.mock('styled-jsx/style', () => ({
  default: ({ children }: any) => null,
}));

describe('MarketTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null (renders nothing) when fetch returns empty array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => [],
      })
    );

    const { container } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MarketTicker />
      </SWRConfig>
    );

    // Component returns null when items.length === 0
    // After fetch resolves, the component should still return null for empty array
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/charts/ticker');
    });

    // The component returns null, so container should be empty
    expect(container.innerHTML).toBe('');
  });

  it('renders ticker items with model names and scores after fetch', async () => {
    const mockItems = [
      {
        name: 'GPT-4o',
        slug: 'gpt-4o',
        provider: 'OpenAI',
        score: 92.5,
        delta: 1.2,
        rank: 1,
      },
      {
        name: 'Claude 3.5',
        slug: 'claude-35',
        provider: 'Anthropic',
        score: 91.0,
        delta: -0.5,
        rank: 2,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => mockItems,
      })
    );

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MarketTicker />
      </SWRConfig>
    );

    // Wait for items to render (items are doubled for seamless loop)
    await waitFor(() => {
      expect(screen.getAllByText('GPT-4o').length).toBeGreaterThan(0);
    });

    // Both model names should appear
    expect(screen.getAllByText('Claude 3.5').length).toBeGreaterThan(0);

    // Scores should be rendered (formatted to 1 decimal)
    expect(screen.getAllByText('92.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('91.0').length).toBeGreaterThan(0);
  });

  it('each item links to /models/{slug}', async () => {
    const mockItems = [
      {
        name: 'GPT-4o',
        slug: 'gpt-4o',
        provider: 'OpenAI',
        score: 92.5,
        delta: 1.2,
        rank: 1,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => mockItems,
      })
    );

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MarketTicker />
      </SWRConfig>
    );

    // Wait for links to render
    await waitFor(() => {
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
    });

    const links = screen.getAllByRole('link');
    // All links should point to /models/{slug}
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/models/gpt-4o');
    });
  });
});
