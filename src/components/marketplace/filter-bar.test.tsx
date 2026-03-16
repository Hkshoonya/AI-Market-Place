/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import { MarketplaceFilterBar } from './filter-bar';

// Override next/navigation mock to capture router.push and provide custom searchParams
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/marketplace/browse',
}));

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  LayoutGrid: (props: any) => <span data-testid="grid-icon" {...props} />,
  List: (props: any) => <span data-testid="list-icon" {...props} />,
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Key: (props: any) => <span data-testid="key-icon" {...props} />,
  Package: (props: any) => <span data-testid="package-icon" {...props} />,
  Code: (props: any) => <span data-testid="code-icon" {...props} />,
  Database: (props: any) => <span data-testid="database-icon" {...props} />,
  FileText: (props: any) => <span data-testid="filetext-icon" {...props} />,
  Bot: (props: any) => <span data-testid="bot-icon" {...props} />,
  Server: (props: any) => <span data-testid="server-icon" {...props} />,
}));

describe('MarketplaceFilterBar', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders search input, type filter buttons, sort options, and view toggle', () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={42} /></SWRConfig>);

    // Search input
    expect(
      screen.getByRole('textbox', { name: /search marketplace listings/i })
    ).toBeInTheDocument();

    // Type filter buttons: "All" + 7 listing types
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Weights')).toBeInTheDocument();
    expect(screen.getByText('Fine-tuned')).toBeInTheDocument();
    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('MCP')).toBeInTheDocument();
    expect(screen.getByText('Autonomous Ready')).toBeInTheDocument();
    expect(screen.getByText('Manifest Backed')).toBeInTheDocument();
    expect(screen.getByText('Agent Sellers')).toBeInTheDocument();

    // Sort options
    expect(screen.getByText('Trust')).toBeInTheDocument();
    expect(screen.getByText('Autonomy')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(
      screen.getByText(/trust prioritizes seller verification, commerce posture, ratings, and safer marketplace signals/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Newest')).toBeInTheDocument();
    expect(screen.getByText('Rating')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();

    // View toggle buttons
    expect(
      screen.getByRole('button', { name: /grid view/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /list view/i })
    ).toBeInTheDocument();
  });

  it('clicking a type filter calls router.push with updated type param', async () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={10} /></SWRConfig>);

    await user.click(screen.getByText('API'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });

    // Verify the pushed URL contains the type param
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('type=api_access');
  });

  it('reflects initial URL search params in active state', () => {
    mockSearchParams = new URLSearchParams('type=dataset&sort=trust&autonomy=ready&seller_mode=agent');
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={5} /></SWRConfig>);

    // The Dataset badge should have the active style (checked via aria-pressed on sort)
    const trustBadge = screen.getByRole('button', {
      name: /sort by trust/i,
    });
    expect(trustBadge).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText(/trust prioritizes seller verification, commerce posture, ratings, and safer marketplace signals/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Autonomous Ready')).toHaveClass('text-neon');
    expect(screen.getByText('Agent Sellers')).toHaveClass('text-neon');
  });

  it('clicking an agent-native filter updates the URL state', async () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={10} /></SWRConfig>);

    await user.click(screen.getByText('Manifest Backed'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('contract=manifest');
  });

  it('keeps seller ids separate from agent-seller filtering', async () => {
    mockSearchParams = new URLSearchParams('seller=seller-123');
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={10} /></SWRConfig>);

    await user.click(screen.getByText('Agent Sellers'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('seller=seller-123');
    expect(pushedUrl).toContain('seller_mode=agent');
  });

  it('shows total count in the component', () => {
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><MarketplaceFilterBar totalCount={123} /></SWRConfig>);
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
