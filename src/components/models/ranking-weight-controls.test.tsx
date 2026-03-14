/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import RankingWeightControls from './ranking-weight-controls';

// Mock lucide-react icons to avoid SVG rendering complexity
vi.mock('lucide-react', () => ({
  Settings2: (props: any) => <span data-testid="icon-settings2" {...props} />,
  RotateCcw: (props: any) => <span data-testid="icon-rotate" {...props} />,
  Info: (props: any) => <span data-testid="icon-info" {...props} />,
  ChevronDown: (props: any) => <span data-testid="icon-chevron" {...props} />,
  Minus: (props: any) => <span data-testid="icon-minus" {...props} />,
  Plus: (props: any) => <span data-testid="icon-plus" {...props} />,
}));

// Mock radix tooltip to render inline (avoid portal issues in jsdom)
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild: _asChild, ...props }: any) => (
    <span {...props}>{children}</span>
  ),
  TooltipContent: ({ children }: any) => <span>{children}</span>,
}));

const mockModels = [
  {
    name: 'GPT-4o',
    slug: 'gpt-4o',
    provider: 'OpenAI',
    category: 'flagship',
    overall_rank: 1,
    category_rank: 1,
    quality_score: 90,
    value_score: 85,
    is_open_weights: false,
    hf_downloads: 500000,
    popularity_score: 95,
    adoption_rank: 1,
    adoption_score: 90,
    agent_score: 88,
    agent_rank: 1,
    popularity_rank: 1,
    economic_footprint_rank: 1,
    economic_footprint_score: 87,
    market_cap_estimate: 5000000,
    capability_score: 92,
    capability_rank: 1,
    usage_score: 91,
    usage_rank: 1,
    expert_score: 89,
    expert_rank: 1,
    balanced_rank: 1,
  },
  {
    name: 'Claude 3.5 Sonnet',
    slug: 'claude-35-sonnet',
    provider: 'Anthropic',
    category: 'flagship',
    overall_rank: 2,
    category_rank: 2,
    quality_score: 88,
    value_score: 82,
    is_open_weights: false,
    hf_downloads: 300000,
    popularity_score: 80,
    adoption_rank: 2,
    adoption_score: 76,
    agent_score: 85,
    agent_rank: 2,
    popularity_rank: 2,
    economic_footprint_rank: 2,
    economic_footprint_score: 74,
    market_cap_estimate: 4000000,
    capability_score: 87,
    capability_rank: 2,
    usage_score: 84,
    usage_rank: 2,
    expert_score: 86,
    expert_rank: 2,
    balanced_rank: 2,
  },
];

describe('RankingWeightControls', () => {
  const onSortedModels: any = vi.fn();

  beforeEach(() => {
    onSortedModels.mockClear();
  });

  it('renders the thesis customization toggle button in collapsed state', () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <RankingWeightControls models={mockModels} onSortedModels={onSortedModels} />
      </SWRConfig>
    );

    expect(screen.getByText('Customize Thesis')).toBeInTheDocument();
    // Weight labels should NOT be visible when collapsed
    expect(screen.queryByText('Capability')).not.toBeInTheDocument();
    expect(screen.queryByText('Economic Footprint')).not.toBeInTheDocument();
  });

  it('expands to show weight labels when toggle is clicked', async () => {
    const user = userEvent.setup();

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <RankingWeightControls models={mockModels} onSortedModels={onSortedModels} />
      </SWRConfig>
    );

    await user.click(screen.getByText('Customize Thesis'));

    // Weight labels should now be visible
    expect(screen.getByText('Capability')).toBeInTheDocument();
    expect(screen.getByText('Economic Footprint')).toBeInTheDocument();
    expect(screen.getByText('Popularity')).toBeInTheDocument();
    expect(screen.getByText('Adoption')).toBeInTheDocument();
    expect(screen.getByText('Agent Score')).toBeInTheDocument();
  });

  it('calls onSortedModels when a weight increase button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <RankingWeightControls models={mockModels} onSortedModels={onSortedModels} />
      </SWRConfig>
    );

    // Expand the controls
    await user.click(screen.getByText('Customize Thesis'));

    // Clear any initial calls from the mount effect
    onSortedModels.mockClear();

    // Click the increase button for Capability
    await user.click(screen.getByLabelText('Increase Capability weight'));

    // onSortedModels should have been called with an array
    expect(onSortedModels).toHaveBeenCalled();
    const sortedResult = onSortedModels.mock.calls[0][0];
    expect(Array.isArray(sortedResult)).toBe(true);
    expect(sortedResult).toHaveLength(mockModels.length);
  });

  it('resets weights and calls onSortedModels when Reset to Default is clicked', async () => {
    const user = userEvent.setup();

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <RankingWeightControls models={mockModels} onSortedModels={onSortedModels} />
      </SWRConfig>
    );

    // Expand the controls
    await user.click(screen.getByText('Customize Thesis'));

    // Change a weight first so Reset is enabled
    await user.click(screen.getByLabelText('Increase Capability weight'));
    onSortedModels.mockClear();

    // Click Reset to Default
    await user.click(screen.getByText('Reset House View'));

    // onSortedModels should be called again with the reset-sorted models
    expect(onSortedModels).toHaveBeenCalled();
    const sortedResult = onSortedModels.mock.calls[0][0];
    expect(Array.isArray(sortedResult)).toBe(true);
    expect(sortedResult).toHaveLength(mockModels.length);
  });
});
